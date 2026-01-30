const { Client } = require('@neondatabase/serverless');

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' })
        };
    }

    try {
        const { fullname, email, password, phone, timestamp } = JSON.parse(event.body);

        // Validation
        if (!email || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Email and password are required' })
            };
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Invalid email format' })
            };
        }

        // Get database URL from environment variables
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            console.error('DATABASE_URL not configured');
            return {
                statusCode: 500,
                body: JSON.stringify({ message: 'Database not configured' })
            };
        }

        // Create database connection
        const client = new Client({
            connectionString: connectionString,
        });

        await client.connect();

        // Create tables if they don't exist
        await client.query(`
            CREATE TABLE IF NOT EXISTS signup_users (
                id SERIAL PRIMARY KEY,
                fullname VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS login_users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                success BOOLEAN DEFAULT true
            );
        `);

        // Check if user exists in signup_users table
        const userResult = await client.query(
            'SELECT id, fullname, email, password, phone FROM signup_users WHERE email = $1',
            [email]
        );

        if (userResult.rows.length === 0) {
            await client.end();
            return {
                statusCode: 401,
                body: JSON.stringify({ message: 'Email not found. Please sign up first.' })
            };
        }

        const user = userResult.rows[0];

        // Verify password
        if (user.password !== password) {
            // Log failed login attempt
            await client.query(
                `INSERT INTO login_users (email, success) VALUES ($1, false)`,
                [email]
            );
            await client.end();
            return {
                statusCode: 401,
                body: JSON.stringify({ message: 'Invalid password. Please try again.' })
            };
        }

        // Log successful login
        await client.query(
            `INSERT INTO login_users (email, success) VALUES ($1, true)`,
            [email]
        );

        await client.end();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Login successful!',
                user: {
                    fullname: user.fullname,
                    email: user.email,
                    phone: user.phone
                }
            })
        };

    } catch (error) {
        console.error('Database error:', error);

        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: 'Server error. Please try again later.',
                error: error.message 
            })
        };
    }
};
