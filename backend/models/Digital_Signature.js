const Signature = {
    _id: {
        type: String,
        required: true,
        unique: true,
    },
    signature: {
        type: String,
        required: true,
        unique: true,
    }
};

module.exports = Signature;
