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
        if (!fullname || !email || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Missing required fields' })
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

        // Validate password strength
        if (password.length < 8) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Password must be at least 8 characters' })
            };
        }

        if (!/[A-Z]/.test(password)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Password must contain uppercase letter' })
            };
        }

        if (!/[a-z]/.test(password)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Password must contain lowercase letter' })
            };
        }

        if (!/\d/.test(password)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Password must contain a number' })
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

        // Create table if it doesn't exist
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

        // Check if email already exists
        const existingUser = await client.query(
            'SELECT email FROM signup_users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            await client.end();
            return {
                statusCode: 409,
                body: JSON.stringify({ message: 'Email already registered. Please login or use a different email.' })
            };
        }

        // Insert signup data into database
        await client.query(
            `INSERT INTO signup_users (fullname, email, password, phone) 
             VALUES ($1, $2, $3, $4)`,
            [fullname, email, password, phone]
        );

        await client.end();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Account created successfully!',
                user: {
                    fullname,
                    email,
                    phone
                }
            })
        };

    } catch (error) {
        console.error('Database error:', error);

        // Check if it's a duplicate email error
        if (error.code === '23505') {
            return {
                statusCode: 409,
                body: JSON.stringify({ message: 'Email already registered. Please use a different email.' })
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: 'Server error. Please try again later.',
                error: error.message 
            })
        };
    }
};
