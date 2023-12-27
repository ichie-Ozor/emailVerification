import express from 'express'
import dotenv from 'dotenv'
import { connectDb } from './config/db.js'
import { router } from './api/userRouter.js'

dotenv.config()
const PORT = process.env.PORT
const DB_URL = process.env.MONGODB_URL


const app = express()
app.use(express.json())
app.use('/user', router)

app.listen(PORT, async () => {
    await connectDb(DB_URL)
    console.log(`Server is running on port ${PORT}...`)
})
