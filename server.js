import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.static('public'));

// Create a PostgreSQL Pool with the provided database connection string
const { Pool } = pg;
const dbString = process.env.DATABASE_URL;
const PORT = process.env.PORT;
const pool = new Pool({
  connectionString: dbString
});

// Enable JSON request body parsing
app.use(express.json());

// Route for the root endpoint
app.get('/', (req, res) => {
  res.send('Lift Track API!');
});

// Route for user registration
app.post('/api/users/register', async (req, res) => {
  const { username, password } = req.body;

  // Hash the password before storing it in the database
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Insert the user into the "users" table and return the new user
    const result = await pool.query(
      'INSERT INTO "users" (username, password) VALUES ($1, $2) RETURNING *',
      [username, hashedPassword]
    );

    const newUser = result.rows[0];
    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Route for user login
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Retrieve user information based on the provided username
    const result = await pool.query('SELECT * FROM "users" WHERE username = $1', [username]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isPasswordMatch = await bcrypt.compare(password, user.password);

      // Check if the provided password matches the stored hashed password
      if (isPasswordMatch) {
        res.status(200).json({ user, success: true, message: 'Login successful' });
      } else {
        res.status(401).json({ success: false, message: 'Incorrect password' });
      }
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Route for creating a new workout plan
app.post('/api/workout-plans', async (req, res) => {
  const { user_id, plan_name, description } = req.body;

  try {
    // Insert a new workout plan into the "workout_plan" table and return the new plan
    const result = await pool.query(
      'INSERT INTO "workout_plan" (user_id, plan_name, description) VALUES ($1, $2, $3) RETURNING *',
      [user_id, plan_name, description]
    );

    const newWorkoutPlan = result.rows[0];
    res.status(201).json(newWorkoutPlan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Route for fetching workout plans for a specific user
app.get('/api/workout-plans/:user_id', async (req, res) => {
  const user_id = req.params.user_id;

  try {
    // Retrieve workout plans for the specified user from the "workout_plan" table
    const result = await pool.query(
      'SELECT plan_id, plan_name, description FROM "workout_plan" WHERE user_id = $1',
      [user_id]
    );

    const workoutPlans = result.rows;
    res.status(200).json(workoutPlans);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Route for deleting a workout plan and its associated exercises
app.delete('/api/workout-plans/:planId', async (req, res) => {
  const planId = req.params.planId;
  try {
    // Start a transaction to ensure atomicity
    await pool.query('BEGIN');

    // Delete exercises associated with the workout plan
    const deleteExercisesQuery = 'DELETE FROM "exercise" WHERE plan_id = $1';
    await pool.query(deleteExercisesQuery, [planId]);

    // Delete the workout plan and retrieve the deleted plan
    const deleteWorkoutPlanQuery = 'DELETE FROM "workout_plan" WHERE plan_id = $1 RETURNING *';
    const deleteWorkoutPlanResult = await pool.query(deleteWorkoutPlanQuery, [planId]);

    // Commit the transaction
    await pool.query('COMMIT');

    // Check if the workout plan was found and deleted successfully
    if (deleteWorkoutPlanResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Workout plan not found.' });
      return;
    }

    const deletedPlan = deleteWorkoutPlanResult.rows[0];
    res.status(200).json({ success: true, message: `Workout plan with ID ${planId} and associated exercises deleted successfully.` });
  } catch (error) {
    // Rollback the transaction in case of an error
    await pool.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }    
});

// Route for adding an exercise to a workout plan
app.post('/api/exercises/:planId', async (req, res) => {
  const planId = req.params.planId;
  const { exercise_name, sets, repetitions, notes } = req.body;

  try {
    // Insert a new exercise into the "exercise" table and return the new exercise
    const insertExerciseQuery = `
      INSERT INTO "exercise" (plan_id, exercise_name, sets, repetitions, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`;
    const insertedExercise = await pool.query(insertExerciseQuery, [planId, exercise_name, sets, repetitions, notes]);

    res.status(201).json({
      success: true,
      message: 'Exercise added to workout plan successfully.',
      exercise: insertedExercise.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Route for fetching exercises for a specific workout plan
app.get('/api/exercises/:planId', async (req, res) => {
  const planId = req.params.planId;

  try {
    // Retrieve exercises for the specified workout plan from the "exercise" table
    const getExercisesQuery = 'SELECT * FROM "exercise" WHERE plan_id = $1';
    const exercisesResult = await pool.query(getExercisesQuery, [planId]);

    const exercises = exercisesResult.rows

        res.status(200).json(exercises);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Server Listener
app.listen(PORT, () => {
    console.log(`Listening on port; ${PORT}`)
});