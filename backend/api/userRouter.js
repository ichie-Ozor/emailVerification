import express from 'express'
import dotenv from 'dotenv'
import { User } from '../Model/userModel.js'
import { UserVerification } from '../Model/UserVerificationModel.js'
import nodemailer from 'nodemailer'
import path from 'path'
import bcrypt from 'bcrypt'
import { uuid } from 'uuidv4'
// const {v4: uuidv4} = require("uuid")

export const router = express.Router()
// User email Verification. This will send email to the user email 
dotenv.config()


////////////////////////////////////////////////////////////
let transporter = nodemailer.createTransport({                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      
    service: "smtp.gmail.com",
    port: 587,
    secure: false, //true for 465 and false for other
    logger: true,
    debug: true,
    secureConnection: false, //this is because we are using localhost
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASS
    }, 
    tls: {
        rejectUnauthorized: true
    }
})
/////////////////////////////////////////////////////////////////////////


// testing success. We want to check if it will work
// this will give you an error, but you need to generate a password from google for this app if your google account have a 2F authentication. 
// go to https://myaccount.google.com/apppasswords and generate it. Then use the password generated as the password in the .env file
transporter.verify((error, success) => {
    if (error) {
        console.log(error)
    } else {
        console.log("Ready for message")
        console.log(success)
    }
})




//signup 
router.post('/signup', (req, res) => {
    let {name, email, password, dateOfBirth} = req.body
    name = name.trim();
    email = email.trim();
    password = password.trim();
    dateOfBirth = dateOfBirth.trim();

    if(name == "" || email == "" || password == "" || dateOfBirth == ""){
        res.json({
            status: "Failed",
            message: "Empty input fields"
        })
    } else if (!/^[a-zA-Z ]*$/.test(name)){
        res.json({
            status: "Failed",
            message: "Invalid name entered"
        })
    } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)){
        res.json({
            status: "Failed",
            message: "Invalid email entered"
        })
    } else if (!new Date(dateOfBirth).getTime()){
        res.json({
            statue: "Fialed",
            message: "Invalid date of birth entered"
        })
    } else if (password.length < 8){
        res.json({
            status: "Fialed",
            message: "Password is too short!"
        })
    } else {
        //check if the user already exist in the database
         User.find({email})
         .then(result => {
            if (result.length){
                // A user already exists
                res.json({
                    status: "Failed",
                    message: "User with the provided email already exists"
                })
            } else {
                //    create new user and password handling
                const saltRound = 10;
                bcrypt.hash(password, saltRound).then(hashedPassword => {
                const newUser = new User({
                    name,
                    email,
                    password: hashedPassword,
                    dateOfBirth,
                    verified: false    //this is used for the email verification
                });
                newUser.save().then(result => {
                    //Once the user is successfully save, instead of a success message, we send an email by calling the function
                    //handle account verification
                    sendVerificationEmail(result, res);
                }).catch(err => {
                    console.log(err)
                   res.json({
                    status: "Failed",
                    message: ""
                   })
                })
             }).catch(err => {
                res.json({
                    status: "Failed",
                    message: "An error occured while saving the user"
                })
            })
            }
         }).catch(err => {
            console.log(err);
            res.json({
                status: "Failed",
                message: "An error occured while checking for existing user"
            })
         })
         
    }
})


//////////////////////////////////////////////////////////
//send verification email
const sendVerificationEmail = ({_id, email}, res) => {
//the id in this case is that generated by mongodb
const currentUrl = "http://localhost:5000/";  //this is the url we will be using in the email. we use 
                                              //localhost because the app has not being hosted

const uniqueString = uuid() + _id;

//mail options
const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "verify your email",
    html: `<p>Verify your email address to complete the signup and login into your account.</p><p>This link <b>expires in 6 hours</b></p><p>Press <a href=${currentUrl + "user/verify/" + _id + "/" + uniqueString}>here</a> to proceed.</p>`
};
console.log(_id, uniqueString, "this is it")
//we will need to hash the unique string and store it in the user verification collection
//hash the unique string
const saltRounds = 10;
bcrypt
.hash(uniqueString, saltRounds)
.then((hashedUniqueString) => {
    //set value in userVerification collection
    const newVerification = new UserVerification({
       userId: _id,
       uniqueString: hashedUniqueString,
       createdAt: Date.now(),
       expiresAt: Date.now() + 21600000,
    })

    newVerification
    .save()
    .then(() => {
        transporter
        .sendMail(mailOptions)
        .then(() => {             //email has being sent at this point
            res.json({
                status: "PENDING",
                message: "Verification email sent"
            })
        })
        .catch((error) => {
            console.log(error)
            res.json({
                status: "Failed",
                message: "Verification email failed!",
            })
        })
    })
    .catch((error) => {
        console.log(error)
        res.json({
            status: "Filed",
            message: "Could not save verification email data!",
        })
    })
})
.catch(() => {
    res.json({
        status: "Filed",
        message: "An error occured while hashing email data!",
    })
})
}
/////////////////////////////////////////////////////////
/////Link the user will be clicking 
router.get("/verify/:userId/:uniqueString", (req, res) => {
  let { userId, uniqueString } = req.params;
console.log(UserVerification.find({userId, uniqueString }), "us")
  UserVerification
  .find({userId, uniqueString })
  .then((result) => {
    console.log(result, "see me")
    if (result.length > 0){
    //user verification record exist so we proceed
    //check if the record has expired

    const { expiresAt} = result[0]
    const hashedUniqueString = result[0].uniqueString;

        if(expiresAt < Date.now()){
            //if the record has expired we delete it from the userverification
            UserVerification
            .deleteOne({userId})
            .then(result => {
                User.deleteOne({ _id: userId})
                .then(() => {
                    let message = "Link has exxpired, please sign up again";
                    res.redirect(`/user/verified/error=true&message=${message}`)
                })
                .catch(error => {
                    let message = "Clearing user with expired unique string failed";
                    res.redirect(`/user/verified/error=true&message=${message}`)
                })
            })
            .catch((error) => {
                console.log(error)
                let message = "An error occured while clearing expired user verification record";
                res.redirect(`/user/verified/error=true&message=${message}`)
            })
        } else {
            //valid record exist so we validate the user string
            //First compare the hashed unique string
    
        bcrypt.compare(uniqueString, hashedUniqueString)
        .then(result => {
            if(result){

                //String matches

                User
                .updateOne({_id: userId}, {verified: true})
                .then(() => {
                    UserVerification
                    .deleteOne({userId})
                    .then(() => {
                        res.sendFile(path.join(__dirname, "./../view/view.html")) //this is the page the user gets when they are verified
                    })
                    .catch(error => {
                        console.log(error)
                        let message = "An error occured while finalising successful verification";
                        res.redirect(`/user/verified/error=true&message=${message}1`)
                    })
                })
                .catch(error => {
                    console.log(error)
                    let message = "An error occured while updating user record to show verified";
                    res.redirect(`/user/verified/error=true&message=${message}2`)
                })
            }else {
                //existing record but incorrect verification
                let message = "Invalid verification details passed, check your inbox";
                res.redirect(`/user/verified/error=true&message=${message}3`)
            }
        })
        .catch(error => {
            console.log(error)
            let message = "An error occured while clearing expired user verification record";
            res.redirect(`/user/verified/error=true&message=${message}4`)
        })
    }
    } else {
        //user verification record doesnt exist
        let message = "Account record does not exist or have been verified already. Please sign in or login";
        res.redirect(`/user/verified/error=true&message=${message}5`)
    }
  })
  .catch((error) => {
    console.log(error)
    // we want to redirect the user to a html file wheather it is a success or error
   let message = "An error occured while checking for existing user verification recored";
   res.redirect(`/user/verified/error=true&message=${message}6`)
  })
})



///verified page route
router.get("/verified", (req, res) => {
    res.sendFile(path.join(__dirname, "./../view/view.html"))
})



// Sign In
router.post('/signin', (req, res) => {
    let { email, password } = req.body;
    email = email.trim()
    password = password.trim();

    if (email == "" || password == ""){
        res.json({
            status: "Failed",
            message: "Please suppliy the needed email and password"
        })
    } else {
        User.find({email})
        .then((data) => {  
            if (data.length){

                //checking if the user isverified

                if(!data[0].verified){
                    res.json({
                        status: "Failed",
                        message: "This email is not verified, please check your inbox"
                    })
                } else {
                    //checking if the user exist
                const hashedPassword = data[0].password;
                bcrypt.compare(password, hashedPassword).then((result) => {
                    if(result){
                        // if the password matches
                        res.json({
                            status: "Success",
                            message: "Signed In successfully",
                            data: data,
                        });
                    } else {
                        res.json({
                            status: "Failed",
                            message: "invalid password or email"
                        })
                    }
                }).catch(err => {
                    res.json({
                        status: "Failed",
                        message: "An error occured while comparing password"
                    })
                })
                }    
            } 
        }).catch(err => {
            console.log(err)
            res.json({
                status: "Failed",
                message: "An error occured while checking for existing user email"
            })
        })
    }
})

