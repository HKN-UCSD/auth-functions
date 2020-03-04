const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

/* data = {email: string (person to change role of),
            role: string (role to change to)} */ 
exports.addClaim = functions.https.onCall(async (data) => {

    // check caller exists
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "The function must be called while authenticated."
         );
    }

    const caller_uid = context.auth.uid;
    const authToken = context.auth.token;

    // check if caller has officer token
    if (!("officer" in authToken) || !authToken.Officer) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "The function must be called by user with an officer token."
         );
    }

    // get officer id from db
    const officer_id = getIdFromRoles("Officer");

    // check if caller doc has role of officer
    const user_doc = await admin.firestore().collection('users').doc(caller_uid).get()
    if (user_doc.get('role_id') !== officer_id) {
        throw new functions.https.HttpsError(
            "failed-precondition",
            "The function must be called by user with an officer role."
        )
    }

    // verified caller, find user
    const email = data.email;
    const role = data.role;

    // check if user exists in auth
    const user = await admin.auth().getUserByEmail(email);
    const user_uid = user.uid;

    // get role_id from db
    const roleID = await getIdFromRoles(role);

    // check for user doc and set role
    await admin.firestore().collection('users').doc(user_uid).update({role_id: roleID}).catch(err => {
        throw new functions.https.HttpsError(err.code, err.details);
    });

    // set claim for role
    await admin.auth().setCustomUserClaims(user.uid, {[role]: true}).catch(err => {
        throw new functions.https.HttpsError(err.code, err.details);
    });

    return {success: true}
});

function getIdFromRoles(role) {
    return admin.firestore().collection('roles').where("value","==",role).get()
        .then(querySnapshot => {
            if(querySnapshot.empty) {
                throw new functions.https.HttpsError(
                    "not-found",
                    "Role " + role + " does not exist."
                )
            }
            return querySnapshot.docs[0].id
        })
}