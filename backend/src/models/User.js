const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            minlength: 6
        },

        resetPasswordToken: { type: String, select: false },
        resetPasswordExpires: { type: Date, select: false },

        avatar: {
            type: String,
            default: ""
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },

        credits: {
            type: Number,
            default: 10,
            min: 0,
            validate: {
                validator: Number.isInteger,
                message: "Credits must be a non-negative integer"
            }
        }
    },
    {
        timestamps: true
    }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
