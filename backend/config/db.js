import { connect } from 'mongoose'

export const connectDb = async (url) => {
    await connect(url)
    console.log('connected to DB successfully!')
}