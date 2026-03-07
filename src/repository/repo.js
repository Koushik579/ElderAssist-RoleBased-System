const pool = require("../database/pool");

async function insertusers(fname,lname,gender,email,phn,pass,role) {
    const result = await pool.query(
        "insert into users(fname,lname,gender,email,phone,password,role) values($1,$2,$3,$4,$5,$6,$7) returning *",
        [fname,lname,gender,email,phn,pass,role]
    );
    return result.rows[0];
};

async function checkuser(email) {
    const results = await pool.query(
        "select * from users where email = $1",
        [email]
    );
    return results.rows[0];
}

async function getUserProfileById(id) {
    const results = await pool.query(
        "select id, fname, lname, gender, email, phone, role from users where id = $1",
        [id]
    );
    return results.rows[0];
}

async function getBookingsColumns() {
    const result = await pool.query(
        `select column_name
         from information_schema.columns
         where table_schema = 'public' and table_name = 'bookings'`
    );
    return new Set(result.rows.map((row) => row.column_name));
}

async function resolveStatusColumn() {
    const columns = await getBookingsColumns();
    if (columns.has("status")) {
        return "status";
    }
    if (columns.has("staus")) {
        return "staus";
    }
    return null;
}

async function bookAppointment(appointmentInput) {
    const columns = await getBookingsColumns();
    const statusColumn = await resolveStatusColumn();

    const insertColumns = [
        "user_id",
        "service_id",
        "booking_date",
        "booking_time",
        "duration_hours",
        "patient_age",
        "notes",
        "hourly_rate",
        "total_price"
    ];

    const values = [
        appointmentInput.userId,
        appointmentInput.serviceId,
        appointmentInput.bookingDate,
        appointmentInput.bookingTime,
        appointmentInput.durationHours,
        appointmentInput.patientAge,
        appointmentInput.notes,
        appointmentInput.hourlyRate,
        appointmentInput.totalPrice
    ];

    if (columns.has("caregiver_id")) {
        insertColumns.push("caregiver_id");
        values.push(appointmentInput.caregiverId || null);
    }

    if (statusColumn) {
        insertColumns.push(statusColumn);
        values.push("PENDING");
    }

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(", ");
    const sql = `insert into bookings(${insertColumns.join(",")}) values(${placeholders}) returning *`;
    const result = await pool.query(sql, values);
    return result.rows[0];
}

async function services() {
    const results = await pool.query(
        "select * from services order by id asc"
    );
    return results.rows;
}

async function caregivers() {
    const result = await pool.query(
        `select
            c.id,
            c.first_name,
            c.last_name,
            c.service_id,
            c.experience_years,
            c.qualification,
            c.phone,
            c.email,
            c.rating,
            c.status,
            s.service_name,
            s.price
         from caregivers c
         left join services s on s.id = c.service_id
         order by c.id asc`
    );
    return result.rows;
}

async function getServiceById(id) {
    const results = await pool.query(
        "select * from services where id = $1",
        [id]
    );
    return results.rows[0];
}

async function getUserAppointments(userId) {
    const statusColumn = await resolveStatusColumn();
    const statusSelect = statusColumn ? `b.${statusColumn} as status` : `'PENDING'::text as status`;

    const result = await pool.query(
        `select
            b.booking_id as id,
            b.user_id,
            b.caregiver_id,
            b.service_id,
            b.booking_date,
            b.booking_time,
            b.duration_hours,
            b.patient_age,
            b.notes,
            b.hourly_rate,
            b.total_price,
            ${statusSelect},
            s.service_name,
            concat(c.first_name, ' ', c.last_name) as caregiver_name
         from bookings b
         left join services s on s.id = b.service_id
         left join caregivers c on c.id = b.caregiver_id
         where b.user_id = $1
         order by b.booking_date asc, b.booking_time asc`,
        [userId]
    );
    return result.rows;
}

async function getStaffAppointments() {
    const statusColumn = await resolveStatusColumn();
    const statusSelect = statusColumn ? `b.${statusColumn} as status` : `'PENDING'::text as status`;

    const result = await pool.query(
        `select
            b.booking_id as id,
            b.user_id,
            concat(u.fname, ' ', u.lname) as user_name,
            u.email as user_email,
            b.caregiver_id,
            b.service_id,
            s.service_name,
            b.booking_date,
            b.booking_time,
            b.duration_hours,
            b.patient_age,
            b.notes,
            b.total_price,
            ${statusSelect}
         from bookings b
         left join users u on u.id = b.user_id
         left join services s on s.id = b.service_id
         order by b.booking_date asc, b.booking_time asc`
    );
    return result.rows;
}

async function updateAppointmentStatus(bookingId, nextStatus) {
    const statusColumn = await resolveStatusColumn();
    if (!statusColumn) {
        throw new Error("No status column found in bookings table");
    }

    const result = await pool.query(
        `update bookings
         set ${statusColumn} = $1
         where booking_id = $2
         returning *`,
        [nextStatus, bookingId]
    );
    return result.rows[0];
}

module.exports = {
    insertusers,
    checkuser,
    getUserProfileById,
    bookAppointment,
    services,
    caregivers,
    getServiceById,
    getUserAppointments,
    getStaffAppointments,
    updateAppointmentStatus
};
