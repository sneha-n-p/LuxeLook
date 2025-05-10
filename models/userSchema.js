const mongoose = require("mongoose")
const {Schema} = mongoose
const { v4: uuidv4 } = require("uuid")



const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    lastName:{
        type:String,
        required:false
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        default:null
    },
    gender:{
        type:String,
        required:false
    },
    googleId:{
        type:String,
        unique:false
    },
    password:{
        type:String,
        required:false
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isAdmin:{
        type:Boolean,
        default:false
    },availableCoupons: [{
    type: Schema.Types.ObjectId,
    ref: "Coupon"
}],referredBy: {
  type: String, // or Schema.Types.ObjectId if you want to reference actual User
  default: null
},
    cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart",       
    }],
    wallet:{
        type:Number,
        default:0
    },
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:"Wishlist"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn:{
        type:Date,
        default:Date.now
    },
    referalCode:{
        type: String,
        default: () => uuidv4(),
        unique: true,
        required:true
    },
    image:{
        type:[String],
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category"
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]
})


const User = mongoose.model("user",userSchema)
module.exports = User