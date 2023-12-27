import { Schema, model } from 'mongoose'

const userVerificationSchema = new Schema({
    userId: String,
    uniqueString: String,
    createdAt: Date,
    expiresAt: Date,
});

export const UserVerification = model('UserVerification', userVerificationSchema);
