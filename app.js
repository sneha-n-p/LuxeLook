const express = require('express')
const app = express()
const path = require("path")
const session = require("express-session")
const passport = require('./dbConfig/passport')
const env = require('dotenv').config()
const userRouter = require('./routers/userRouter')
const adminRouter = require('./routers/adminRouter')
const db = require("./dbConfig/db")
const MongoStore = require("connect-mongo")
db()


app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),

    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));


app.use(passport.initialize())
app.use(passport.session())




app.use((req, res, next) => {
    res.set('cache-control', 'no-store')
    next()
})

app.use('/uploads', express.static('uploads'));
app.set("view engine", "ejs")
app.set("views", [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
app.use(express.static(path.join(__dirname, 'public')))

app.use("/", userRouter)
app.use('/admin', adminRouter)

app.listen(process.env.PORT, () => console.log("http://localhost:3000"))

module.exports = app