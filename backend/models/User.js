const User = {
    _id: {
        type: String,
        required: true,
        unique: true,
    },
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    roleID: {
        type: String,
        required: true,
    },
    digital_signatureID: {
        type: String,
        required: true,
    },
    cookieID: {
        type: String,
        required: true,
    }
};

module.exports = User;
