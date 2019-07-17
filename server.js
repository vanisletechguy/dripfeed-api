var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
const busboy = require('connect-busboy');
const busboyBodyParser = require('busboy-body-parser');

var secretKey = 'supersecretypublickey';
var ACTIONS = ['SHOW_POSTS', 'NEW_POST','SHOW_FRIENDS', 'ADD_FRIEND',
	'SHOW_COMMENTS', 'ADD_COMMENT', 'SEARCH_FRIEND', 'UNFRIEND', 'ADD_FRIEND' ]; 



var cors = require('cors');

// use it before all route definitions
app.use(cors({origin: 'http://localhost:8080'}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
var port = process.env.PORT || 3131; 
var router = express.Router();             

const AWS = require('aws-sdk');
const Busboy = require('busboy');
var IAM_USER_KEY = process.env.IAM_USER_KEY; 
var IAM_USER_SECRET = process.env.IAM_USER_SECRET;
const BUCKET_NAME = 'dripfeeds3bucket';
const AWS_DB_USER = process.env.AWS_DB_USER;
const AWS_DB_PASSWORD = process.env.AWS_DB_PASSWORD;
const AWS_DB_NAME = process.env.AWS_DB_NAME;
const AWS_DB_HOST = process.env.AWS_DB_HOST;

var con = mysql.createConnection({
	host: AWS_DB_HOST,
	user: AWS_DB_USER,
	password: AWS_DB_PASSWORD,
	database: AWS_DB_NAME
});

con.connect(function(err) {
	if (err) throw err;
});

app.use(busboy());
app.use(busboyBodyParser());
app.use('/api', router); 
app.listen(port);

///// route:/ ///////////////////
router.get('/', function(req, res) {
	res.json({ message: 'welcome to our api!' });   
});

//// route: login //////////////
router.post('/login', function(req, res) {
	var email = req.headers['email'];
	var password = req.headers['password'];
	//////need to compare password before getting token here
	getToken(email, password, res);
});

//// route: register////////////////////
router.post('/register', function(req, res) {  
	console.log('at register and req headers are: ', req.headers);
	var hashedPassword = bcrypt.hashSync(req.headers['password'], 8);
	const firstName = req.headers['firstName'];
	const lastName = req.headers['lastName'];
	const email = req.headers['email'];
	const password = req.headers['password'];
	var sql = "INSERT INTO user (firstName, lastName, email, password) VALUES('" +
		firstName + "','" + lastName + "','" + email + "', '" + hashedPassword + "')";
	con.query(sql, function (err) {
		if (err) throw err;
	});
	getToken(email, password, res);
});

////need to set these to use parameters
//// route: newpost: /////////////////////
router.put('/posts', verifyToken, function(req, res) {
	const payload = { title: req.headers.title, description: req.headers.description, 
		userid: req.headers.userid, token: req.headers.token, image: req.headers.picName};
	const action = ACTIONS[1];
	verifyAndDo(req, res, action, payload);
});

//// route:  get posts: //////////////////
router.get('/posts', verifyToken, function(req, res) {
	const payload = { userid: req.headers.userid, token: req.headers.token };
	const action = ACTIONS[0];
	verifyAndDo(req, res, action, payload);
});

//// route: myfriends ////////////////////
router.get('/myfriends', verifyToken, function(req, res) {
	const payload = { userid: req.headers.userid, token: req.headers.token};
	const action = ACTIONS[2];
	verifyAndDo(req, res, action, payload);
});


//////////////////////////USELESS FUNCTION??
//// route: getPic  ////////////////////
router.get('/getpic', verifyToken, function(req, res) {
	let s3 = new AWS.S3({
		accessKeyId: IAM_USER_KEY,
		secretAccessKey: IAM_USER_SECRET,
		Bucket: BUCKET_NAME
	});
	var params = { Bucket: BUCKET_NAME, Key: 'templogo2.jpg'}; // keyname can be a filename
	var imageURL = '';


	s3.getSignedUrl('putObject', params, function (err, url) {
		imageURL = url;
		res.json({imageUrl: imageURL});
	});  //.then(res.json({imageUrl: imageURL}));

});


//// route: sign-s3  ////////////////////
router.get('/sign-s3', (req, res) => {
	let s3 = new AWS.S3({
		accessKeyId: IAM_USER_KEY,
		secretAccessKey: IAM_USER_SECRET,
		Bucket: BUCKET_NAME
	});
	const fileName = req.headers['picturename'];
	const fileType = req.headers.filetype;
	const s3Params = {
		Bucket: BUCKET_NAME, 
		Key: fileName,
		Expires: 60,
		ContentType: fileType,
		ACL: 'public-read'
	};
	var returnData = {};
	s3.getSignedUrl('putObject', s3Params, (err, data) => {
		if(err){
			console.log(err);
			return res.end();
		}
		returnData = {
			signedRequest: data,
			url: `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`
		};
		res.status(200).json({message: 'sucess??', data: returnData});
	}); 
});


/////////////////////////////////////// route: showComments ////////////////////
router.get('/comments', verifyToken, function(req, res) {
	const payload = { userid: req.headers.userid, postid: req.headers.postid, 
		token: req.headers.token};
	const action = ACTIONS[4];
	verifyAndDo(req, res, action, payload);
});


/////////////////////////////////////// route: addComment ////////////////////
router.put('/comments', verifyToken, function(req, res) {
	const payload = { userid: req.headers.userid, postid: req.headers.postid, 
		token: req.headers.token, comment: req.headers.text};
	const action = ACTIONS[5];
	verifyAndDo(req, res, action, payload);
});


/////////////////////////////////////// route: searchUser  ////////////////////
router.get('/search', verifyToken, function(req, res) {
	const payload = { userid: req.headers.userid, token: req.headers.token, 
		firstName: req.headers.firstname, lastName: req.headers.lastname };
	const action = ACTIONS[6];
	verifyAndDo(req, res, action, payload);
});


/////////////////////////////////////// route: unfriend  ////////////////////
router.get('/unfriend', verifyToken, function(req, res) {
	console.log('at unfriend');
	const payload = { userid: req.headers.userid, token: req.headers.token, 
		friendid: req.headers.friendid };
	const action = ACTIONS[7];
	
	console.log('verifying');
	verifyAndDo(req, res, action, payload);
});

/////////////////////////////////////// route: addfriend ////////////////////
router.get('/addfriend', verifyToken, function(req, res) {
	console.log('at add friend');
	const payload = { userid: req.headers.userid, token: req.headers.token, 
		friendid: req.headers.friendid };
	const action = ACTIONS[8];
	
	console.log('verifying');
	verifyAndDo(req, res, action, payload);
});




///////////////////no longer used?
router.post('/upload', function (req, res, next) {
	console.log('request', req.headers);
	var busboy = new Busboy({ headers: req.headers });
	
	busboy.on('finish', function() {
		const file = req.headers.picture;
		const fileName = req.headers.picname;		
		const payload = { title: req.headers.title, description: req.headers.description,
			userid: req.headers.userid, token: req.headers.token, imageURI: '', picName: fileName};
		uploadToS3(req, res, file, payload);
	});
	req.pipe(busboy);
});




////////////////////////////////////// function: getToken///////////////////
function getToken(email, password, res) {
	console.log('at get token');
	var sql = "SELECT iduser FROM user WHERE email = '" + email + "'";
	console.log('the sql is: ', sql);
	var newToken = '';
	con.query(sql, function (err, result) {
		if (err) {
			console.log('at error res is ', res); 
			res.json({success: false, message: "email not found"});
			throw err;
		}
		if(result[0]) { var userId = result[0].iduser; }
		if(!userId){ res.json({success: false, message: "email not found"});}

		console.log('searching for user ...');
		if(userId) {
			newToken = jwt.sign({ id: userId }, secretKey, {
				expiresIn: 86400 // expires in 24 hours
			});
			var addKeyQuery = "UPDATE user SET token = '" + newToken + "' WHERE iduser = " + userId;
			console.log('found the user, addKeyQuery is: ', addKeyQuery);
			con.query(addKeyQuery, function (err) {
				if(err) throw err;
				res.json({success: true, yourToken: newToken, userId: userId, email: email});
			});
		}
	});
}

//write similar validate input function//
////////////////////////////////////// function: verifyToken //////////////////
function verifyToken(req, res, next) {
	let sentToken = req.headers['token'];
	if(!sentToken){sentToken = req.headers.token;} //get vs put check
	req.token = sentToken;
	next();
}

////////////////////////////////////// function: verifyAndDo //////////////////
function verifyAndDo(req,res, action, payload){
	jwt.verify(payload.token, secretKey, (err,authData) => {
		console.log('aaa');
		if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
		else {
			console.log('bbb');
			if(true || payload.userid == authData.id || payload.userid == authData.id || true){ //or true?
				console.log('ccc');
				switch (action) {
				case 'NEW_POST':
					var sql = "INSERT INTO post (title, description, userid, imageURI) VALUES('" 
						+payload.title+ "', '"+payload.description+"', "+payload.userid+",'"+payload.picName+"')";
					console.log('the sql is', sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.status(200).json({message: 'created posts successfully', posts: result});
					});
					break;
				case 'SHOW_POSTS':
					sql = "SELECT * FROM post WHERE userid = " + payload.userid;
					console.log('the sql is: ',sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.status(200).json({message: 'retrieved posts successfully', posts: result});
					});
					break;
				case 'SHOW_FRIENDS': 
					sql = "SELECT * from user WHERE user.iduser IN (SELECT friend FROM friendlist WHERE listowner = " + payload.userid + ")";
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.status(200).json({message: 'retrieved friends successfully', friends: result});
					});
					break;
				case 'SHOW_COMMENTS':
					sql = "SELECT * FROM comments WHERE postid = " + payload.postid;
					console.log('the sql is: ',sql);
					con.query(sql, function (err, result) { if (err) throw err; res.status(200).json({message: 'retrieved comments successfully', comments: result});
					});
					break;
				case 'ADD_COMMENT':
					sql = "INSERT INTO comments (text, date, postid, userid) VALUES('" 
						+payload.comment+ "', '"+null+"', "+payload.postid+","+payload.userid+")";
					console.log('the sql is', sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.status(200).json({message: 'created posts successfully', commentResult: result});
					});
					res.json({message: 'not a proper action'});
					break;
				case 'SEARCH_FRIEND':
					sql = "SELECT * FROM user WHERE user.lastName = '" + payload.lastName + "'";
					console.log('the sql is', sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.status(200).json({message: 'retrieved friends successfully', friends: result});
					});
					break;
				case 'ADD_FRIEND':
					sql = "INSERT INTO friendlist (listowner, friend) VALUES(" + payload.userid + ", " + payload.friendid + ")";
					console.log('the sql is', sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						sql = "SELECT * from user WHERE user.iduser IN (SELECT friend FROM friendlist WHERE listowner = " + payload.userid + ")"; con.query(sql, function (err, result) {
							if (err) throw err;
							res.status(200).json({message: 'added friend successfully', success: true, friends: result});
						});
					});
					break;
				case 'UNFRIEND':
					sql = "DELETE FROM friendlist WHERE friendlist.listowner = " + payload.userid + " AND friendlist.friend = " + payload.friendid;
					console.log('the sql is', sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						sql = "SELECT * from user WHERE user.iduser IN (SELECT friend FROM friendlist WHERE listowner = " + payload.userid + ")"; con.query(sql, function (err, result) {
							if (err) throw err;
							res.status(200).json({message: 'removed friend successfully', success: true, friends: result});
						});
					});
					break;
				default:
					res.json({message: 'not a proper action'});
				}
			} else {
				res.json({message: 'wrong id'});
			}
		}
	});
}



///other routes
//-------------
//edit user
//edit comment
//edit post
//remove friend
//delete comment
//delete post




/////////////////// refactor routes like this
//	app.route('/book')
//		.get(function (req, res) {
//			res.send('Get a random book')
//		})
//		.post(function (req, res) {
//			res.send('Add a book')
//		})
//		.put(function (req, res) {
//			res.send('Update the book')
//		})



function uploadToS3(req, res, file, payload) {
	console.log('got to uploadtos3');
	console.log('iam user', IAM_USER_KEY);
	console.log('iam secret', IAM_USER_SECRET);
	let s3bucket = new AWS.S3({
		accessKeyId: IAM_USER_KEY,
		secretAccessKey: IAM_USER_SECRET,
		Bucket: BUCKET_NAME
	});
	s3bucket.createBucket(function () {
		var params = {
			Bucket: BUCKET_NAME,
			Key: payload.picName,
			Body: file,
		};
		console.log('the params are', params);
		s3bucket.upload(params, function (err, data) {
			if (err) {
				console.log('error in callback');
				console.log(err);
				return { success: false };
			}
			console.log('success');
			console.log(data);

			var imageURI = data.Location;
			payload.imageURI = imageURI;

			const action = ACTIONS[1];
			verifyAndDo(req, res, action, payload);

			return {
				success: true,
				data: data
			};
		});
	});
}





