const pool = require("../database/pool");

let bookingsSchemaCache = null;
let caregiversSchemaCache = null;

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

async function checkAdminByEmail(email) {
    const results = await pool.query(
        "select * from admins where lower(email) = lower($1) limit 1",
        [email]
    );
    return results.rows[0] || null;
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

async function getBookingsSchema() {
    if (bookingsSchemaCache) {
        return bookingsSchemaCache;
    }

    const columns = await getBookingsColumns();
    const statusColumn = columns.has("status")
        ? "status"
        : columns.has("staus")
            ? "staus"
            : null;
    const idColumn = columns.has("booking_id")
        ? "booking_id"
        : columns.has("id")
            ? "id"
            : null;

    bookingsSchemaCache = {
        columns,
        statusColumn,
        idColumn
    };

    return bookingsSchemaCache;
}

async function getCaregiversColumns() {
    const result = await pool.query(
        `select column_name
         from information_schema.columns
         where table_schema = 'public' and table_name = 'caregivers'`
    );
    return new Set(result.rows.map((row) => row.column_name));
}

async function getCaregiversSchema() {
    if (caregiversSchemaCache) {
        return caregiversSchemaCache;
    }

    const columns = await getCaregiversColumns();
    caregiversSchemaCache = { columns };
    return caregiversSchemaCache;
}

async function ensureCaregiverSchema() {
    await pool.query("alter table caregivers add column if not exists user_id bigint");
    await pool.query(
        "create unique index if not exists caregivers_user_id_uidx on caregivers(user_id) where user_id is not null"
    );
    caregiversSchemaCache = null;
}

async function ensureBookingRatingSchema() {
    await pool.query("alter table bookings add column if not exists rating numeric(2,1)");
    bookingsSchemaCache = null;
}

async function bookAppointment(appointmentInput) {
    const { columns, statusColumn } = await getBookingsSchema();

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

async function getCaregiverBookingCountForDate(caregiverId, bookingDate) {
    const { statusColumn, columns } = await getBookingsSchema();
    if (!columns.has("caregiver_id") || !columns.has("booking_date")) {
        return 0;
    }
    const statusExpr = statusColumn ? `upper(coalesce(${statusColumn}, 'PENDING'))` : `'PENDING'`;
    const result = await pool.query(
        `select count(*)::int as total
         from bookings
         where caregiver_id = $1
           and booking_date = $2
           and ${statusExpr} not in ('CANCELLED', 'REJECTED')`,
        [caregiverId, bookingDate]
    );
    return Number(result.rows[0]?.total || 0);
}

async function getCaregiverUnavailableDates(caregiverId) {
    const { statusColumn, columns } = await getBookingsSchema();
    if (!columns.has("caregiver_id") || !columns.has("booking_date")) {
        return [];
    }
    const statusExpr = statusColumn ? `upper(coalesce(${statusColumn}, 'PENDING'))` : `'PENDING'`;
    const result = await pool.query(
        `select booking_date::text as booking_date, count(*)::int as booking_count
         from bookings
         where caregiver_id = $1
           and booking_date >= current_date
           and ${statusExpr} not in ('CANCELLED', 'REJECTED')
         group by booking_date
         having count(*) >= 10
         order by booking_date asc`,
        [caregiverId]
    );
    return result.rows;
}

async function getCaregiverByIdentity({ userId, email }) {
    const { columns } = await getCaregiversSchema();

    if (columns.has("user_id") && userId) {
        const byUserId = await pool.query(
            `select
                c.id,
                c.user_id,
                c.first_name,
                c.last_name,
                c.email,
                c.phone,
                c.service_id,
                c.experience_years,
                c.qualification,
                c.rating,
                c.status,
                s.service_name
             from caregivers c
             left join services s on s.id = c.service_id
             where c.user_id = $1
             limit 1`,
            [userId]
        );
        if (byUserId.rows[0]) {
            return byUserId.rows[0];
        }
    }

    if (email) {
        const byEmail = await pool.query(
            `select
                c.id,
                c.user_id,
                c.first_name,
                c.last_name,
                c.email,
                c.phone,
                c.service_id,
                c.experience_years,
                c.qualification,
                c.rating,
                c.status,
                s.service_name
             from caregivers c
             left join services s on s.id = c.service_id
             where lower(c.email) = lower($1)
             limit 1`,
            [email]
        );
        if (byEmail.rows[0]) {
            return byEmail.rows[0];
        }
    }

    // Legacy fallback for old schemas that do not have caregivers.user_id.
    if (!columns.has("user_id") && userId) {
        const byId = await pool.query(
            `select
                c.id,
                c.first_name,
                c.last_name,
                c.email,
                c.phone,
                c.service_id,
                c.experience_years,
                c.qualification,
                c.rating,
                c.status,
                s.service_name
             from caregivers c
             left join services s on s.id = c.service_id
             where c.id = $1
             limit 1`,
            [userId]
        );
        return byId.rows[0] || null;
    }

    return null;
}

async function createCaregiverProfileForUser({ userId, firstName, lastName, email, phone }) {
    const existing = await getCaregiverByIdentity({ userId, email });
    if (existing) {
        if (!existing.user_id) {
            await pool.query(
                `update caregivers
                 set user_id = $1
                 where id = $2 and user_id is null`,
                [userId, existing.id]
            );
            return { ...existing, user_id: String(userId) };
        }
        return existing;
    }

    const result = await pool.query(
        `insert into caregivers (user_id, first_name, last_name, service_id, experience_years, qualification, phone, email, rating, status)
         values ($1, $2, $3, null, 0, '', $4, $5, 0, 'AVAILABLE')
         returning id, user_id, first_name, last_name, email, phone, service_id, experience_years, qualification, rating, status`,
        [userId, firstName || "", lastName || "", phone || "", email || ""]
    );
    return result.rows[0] || null;
}

async function syncUserProfileFields({ userId, firstName, lastName, phone }) {
    const result = await pool.query(
        `update users
         set fname = $1,
             lname = $2,
             phone = $3
         where id = $4
         returning id, fname, lname, email, phone, role`,
        [firstName, lastName, phone, userId]
    );
    return result.rows[0] || null;
}

async function getCaregiverSettings({ userId, email }) {
    const [caregiver, serviceRows] = await Promise.all([
        getCaregiverByIdentity({ userId, email }),
        services()
    ]);

    return {
        caregiver: caregiver || null,
        services: serviceRows || []
    };
}

async function updateCaregiverProfile({
    userId,
    email,
    serviceId,
    firstName,
    lastName,
    phone,
    experienceYears,
    qualification,
    status
}) {
    let caregiver = await getCaregiverByIdentity({ userId, email });
    if (!caregiver) {
        caregiver = await createCaregiverProfileForUser({
            userId,
            firstName,
            lastName,
            email,
            phone
        });
    }
    if (!caregiver) {
        return null;
    }

    const client = await pool.connect();
    try {
        await client.query("begin");

        const caregiverResult = await client.query(
            `update caregivers
             set service_id = $1,
                 first_name = $2,
                 last_name = $3,
                 phone = $4,
                 experience_years = $5,
                 qualification = $6,
                 status = $7,
                 email = $8
             where id = $9
             returning id, user_id, first_name, last_name, email, phone, service_id, experience_years, qualification, rating, status`,
            [serviceId, firstName, lastName, phone, experienceYears, qualification, status, email, caregiver.id]
        );

        await client.query(
            `update users
             set fname = $1,
                 lname = $2,
                 phone = $3
             where id = $4`,
            [firstName, lastName, phone, userId]
        );

        await client.query("commit");
        return caregiverResult.rows[0] || null;
    } catch (err) {
        await client.query("rollback");
        throw err;
    } finally {
        client.release();
    }
}

async function getUserAppointments(userId) {
    const { statusColumn, idColumn } = await getBookingsSchema();
    const statusSelect = statusColumn ? `b.${statusColumn} as status` : `'PENDING'::text as status`;
    const bookingIdSelect = idColumn ? `b.${idColumn} as id` : `b.booking_id as id`;

    const result = await pool.query(
        `select
            ${bookingIdSelect},
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
            b.rating,
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

async function getStaffAppointments({ requesterRole, requesterId, requesterEmail }) {
    const { statusColumn, idColumn, columns } = await getBookingsSchema();
    const statusSelect = statusColumn ? `b.${statusColumn} as status` : `'PENDING'::text as status`;
    const bookingIdSelect = idColumn ? `b.${idColumn} as id` : `b.booking_id as id`;

    let whereClause = "";
    let values = [];

    if (requesterRole === "CAREGIVER" && columns.has("caregiver_id")) {
        const caregiver = await getCaregiverByIdentity({ userId: requesterId, email: requesterEmail });
        if (!caregiver) {
            return [];
        }
        whereClause = "where b.caregiver_id = $1";
        values = [caregiver.id];
    }

    const result = await pool.query(
        `select
            ${bookingIdSelect},
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
         ${whereClause}
         order by b.booking_date asc, b.booking_time asc`
        ,
        values
    );
    return result.rows;
}

async function updateAppointmentStatus(bookingId, nextStatus, { requesterRole, requesterId, requesterEmail }) {
    const { statusColumn, idColumn, columns } = await getBookingsSchema();
    if (!statusColumn) {
        throw new Error("No status column found in bookings table");
    }
    if (!idColumn) {
        throw new Error("No booking id column found in bookings table");
    }

    let whereByRole = "";
    let values = [nextStatus, bookingId];

    if (requesterRole === "CAREGIVER" && columns.has("caregiver_id")) {
        const caregiver = await getCaregiverByIdentity({ userId: requesterId, email: requesterEmail });
        if (!caregiver) {
            return null;
        }
        whereByRole = `and caregiver_id = $3`;
        values = [nextStatus, bookingId, caregiver.id];
    }

    const result = await pool.query(
        `update bookings
         set ${statusColumn} = $1
         where ${idColumn} = $2
         ${whereByRole}
         returning *`,
        values
    );
    return result.rows[0];
}

async function cancelUserPendingAppointment(bookingId, userId) {
    const { statusColumn, idColumn, columns } = await getBookingsSchema();
    if (!statusColumn) {
        throw new Error("No status column found in bookings table");
    }
    if (!idColumn) {
        throw new Error("No booking id column found in bookings table");
    }
    if (!columns.has("user_id")) {
        throw new Error("No user_id column found in bookings table");
    }

    const result = await pool.query(
        `update bookings
         set ${statusColumn} = 'CANCELLED'
         where ${idColumn} = $1
           and user_id = $2
           and upper(coalesce(${statusColumn}, 'PENDING')) = 'PENDING'
         returning *`,
        [bookingId, userId]
    );
    return result.rows[0] || null;
}

async function rateCompletedAppointment({ bookingId, userId, rating }) {
    const { statusColumn, idColumn, columns } = await getBookingsSchema();
    if (!statusColumn) {
        throw new Error("No status column found in bookings table");
    }
    if (!idColumn) {
        throw new Error("No booking id column found in bookings table");
    }
    if (!columns.has("user_id")) {
        throw new Error("No user_id column found in bookings table");
    }
    if (!columns.has("caregiver_id")) {
        throw new Error("No caregiver_id column found in bookings table");
    }
    if (!columns.has("rating")) {
        throw new Error("No rating column found in bookings table");
    }

    const client = await pool.connect();
    try {
        await client.query("begin");

        const bookingResult = await client.query(
            `update bookings
             set rating = $1
             where ${idColumn} = $2
               and user_id = $3
               and caregiver_id is not null
               and upper(coalesce(${statusColumn}, 'PENDING')) = 'COMPLETED'
             returning ${idColumn} as id, caregiver_id, rating`,
            [rating, bookingId, userId]
        );

        const booking = bookingResult.rows[0];
        if (!booking) {
            await client.query("rollback");
            return null;
        }

        const aggregateResult = await client.query(
            `update caregivers c
             set rating = aggregated.avg_rating
             from (
                select caregiver_id, round(avg(rating)::numeric, 1) as avg_rating
                from bookings
                where caregiver_id = $1
                  and rating is not null
                  and upper(coalesce(${statusColumn}, 'PENDING')) = 'COMPLETED'
                group by caregiver_id
             ) as aggregated
             where c.id = aggregated.caregiver_id
             returning c.id, c.rating`,
            [booking.caregiver_id]
        );

        await client.query("commit");
        return {
            booking,
            caregiverRating: aggregateResult.rows[0] || null
        };
    } catch (err) {
        await client.query("rollback");
        throw err;
    } finally {
        client.release();
    }
}

async function getAllUsersForAdmin() {
    const result = await pool.query(
        `select
            id,
            fname,
            lname,
            gender,
            email,
            phone,
            role,
            created_at
         from users
         where upper(coalesce(role, '')) = 'USER'
         order by id asc`
    );
    return result.rows;
}

async function getActivePatientServices() {
    const { statusColumn, idColumn } = await getBookingsSchema();
    const statusSelect = statusColumn ? `b.${statusColumn}` : `'PENDING'::text`;
    const bookingIdSelect = idColumn ? `b.${idColumn}` : `b.booking_id`;

    const result = await pool.query(
        `select
            ${bookingIdSelect} as booking_id,
            b.user_id,
            concat(u.fname, ' ', u.lname) as patient_name,
            u.email as patient_email,
            b.caregiver_id,
            concat(c.first_name, ' ', c.last_name) as caregiver_name,
            b.service_id,
            s.service_name,
            b.booking_date,
            b.booking_time,
            b.duration_hours,
            b.total_price,
            ${statusSelect} as status
         from bookings b
         left join users u on u.id = b.user_id
         left join caregivers c on c.id = b.caregiver_id
         left join services s on s.id = b.service_id
         where upper(coalesce(${statusSelect}, 'PENDING')) in ('PENDING', 'APPROVED')
         order by b.booking_date asc, b.booking_time asc`
    );
    return result.rows;
}

module.exports = {
    ensureCaregiverSchema,
    ensureBookingRatingSchema,
    insertusers,
    checkuser,
    checkAdminByEmail,
    getUserProfileById,
    createCaregiverProfileForUser,
    syncUserProfileFields,
    bookAppointment,
    services,
    caregivers,
    getServiceById,
    getCaregiverBookingCountForDate,
    getCaregiverUnavailableDates,
    getCaregiverSettings,
    updateCaregiverProfile,
    getUserAppointments,
    getStaffAppointments,
    updateAppointmentStatus,
    cancelUserPendingAppointment,
    rateCompletedAppointment,
    getAllUsersForAdmin,
    getActivePatientServices
};
