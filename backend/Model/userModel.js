import { Schema, model } from 'mongoose'

const userSchema = new Schema({
    name: String,
    email: String,
    password: String,
    dateOfBirth: Date,
    verified: Boolean  //this is a comment
});

export const User = model('User', userSchema);
// export default User;