const { getDB } = require('./db-atlas');

const loginUser = async (username, password) => {
    const db = getDB();
    const user = await db.collection('users').findOne({ username, password });
    return user;
};

module.exports = { loginUser };
