const mongoose = require("mongoose");

const WalletSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  balance: { 
    type: Number, 
    required: true 
  },
  transactions: [
    {
      amount: { 
        type: Number, 
        required: true
      }, 
      type: { 
        type: String, 
        required: true ,
        enum: ['credit', 'debit'],
      }, 
      date: { 
        type: Date, 
        default: Date.now 
      },
      description : { 
        type:String, 
        required:true 
      }
    }
  ]
});

module.exports = mongoose.model("Wallet", WalletSchema);