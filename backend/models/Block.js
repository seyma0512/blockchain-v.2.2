const Block = {
    _id: {
        type: String,
        required: true,
        unique: true,
    },
    height: {
        type: Number,
        required: true,
    },
    hash: {
        type: String,
        required: true,
    },
    previousHash: {
        type: String,
        required: true,
    },
    timestamp: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    location: {
        type: String,
        required: true,
    },
    incidentType: {
        type: String,
        required: true,
    },
    chain: {
        type: String,
        required: true,
    },
    digitalSignature: {
        type: String,
        required: true,
    },
    data: [{
        fileName: String,
        filePath: String,
        fileType: String,
    }]
};

module.exports = Block;
