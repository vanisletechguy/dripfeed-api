var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var mysql = require('mysql');
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');

var secretKey = 'supersecretypublickey';
var ACTIONS = ['SHOW_POSTS', 'NEW_POST','SHOW_FRIENDS', 'ADD_FRIEND', 'SHOW_COMMENTS', 'ADD_COMMENT' ]; 
//var actt = {0: 'show', 1: 'notshow'};  /// switch above to this style dict
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
var port = process.env.PORT || 3131; 
var router = express.Router();             

var con = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: 'dripfeedpassword',
	database: 'mydb'
});

con.connect(function(err) {
	if (err) throw err;
	//console.log('Connected to database!');
});

app.use('/api', router); // all of our routes will be prefixed with /api
app.listen(port);



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


//console.log('Listening on port ' + port);
/////////////////////////////////////// route:/ ///////////////////////////////
router.get('/', function(req, res) {
	res.json({ message: 'hooray! welcome to our api!' });   
});

///////////////////////////////////// route: login ////////////////////////////
router.post('/login', function(req, res) {
//	var email = req.query['email'];
	var email = req.headers['email'];
	console.log('email', email);
	console.log('headers: ', req.headers);
	getToken(email, res);
});

/////////////////////////////////////// route: register///////////////////////
router.get('/register', function(req, res) {  
	var hashedPassword = bcrypt.hashSync(req.query['password'], 8);
	const firstName = req.query['firstName'];
	const lastName = req.query['lastName'];
	const email = req.query['email'];
	var sql = "INSERT INTO user (firstName, lastName, email, password) VALUES(" +
		firstName + ", " + lastName + ", " + email + ", '" + hashedPassword + "')";
	con.query(sql, function (err) {
		if (err) throw err;
	});
	getToken(email, res);
});


////need to set these to use parameters
///////////////////////////////////// route: newpost: /////////////////////////
router.put('/posts', verifyToken, function(req, res) {
	console.log('the req headers', req.headers)
	
	console.log('the req headers', req.headers.title)
	const payload = { title: req.headers.title, description: req.headers.description, userid: 1
	};
	const action = ACTIONS[1];
	verifyAndDo(req, res, action, payload);
});

//////////////////////////////////// route:  get posts: /////////////////////////
router.get('/posts', verifyToken, function(req, res) {
	
	console.log('got to posts');
	const payload = { userid: 1 };
	const action = ACTIONS[0];
	verifyAndDo(req, res, action, payload);
});

/////////////////////////////////////// route: myfriends ////////////////////
router.get('/myfriends', verifyToken, function(req, res) {
	const payload = { userid: 1 };
	const action = ACTIONS[2];
	verifyAndDo(req, res, action, payload);
});





///////////////////////unfinished functions

/////////////////////////////////////// route: addfriend ////////////////////
router.get('/addfriend', verifyToken, function(req, res) {
	const payload = { userid: 1, friendid: 2 };
	const action = ACTIONS[2];
	verifyAndDo(req, res, action, payload);
});


/////////////////////////////////////// route: addComment ////////////////////
router.get('/addComment', verifyToken, function(req, res) {
	const payload = { userid: 1, postid: 1 };
	const action = ACTIONS[2];
	verifyAndDo(req, res, action, payload);
});


/////////////////////////////////////// route: showComments ////////////////////
router.get('/showComments', verifyToken, function(req, res) {
	const payload = { userid: 1, postid: 1 };
	const action = ACTIONS[2];
	verifyAndDo(req, res, action, payload);
});


///other routes
//-------------
//edit user
//edit comment
//edit post
//remove friend
//delete comment
//delete post




////////////////////////////////////// function: getToken///////////////////
function getToken(email, res) {
	var sql = "SELECT iduser FROM user WHERE email = '" + email + "'";
	var newToken = '';
	con.query(sql, function (err, result) {
		if (err) throw err;
		var userId = result[0].iduser;
		newToken = jwt.sign({ id: userId }, secretKey, {
			expiresIn: 86400 // expires in 24 hours
		});
		var addKeyQuery = "UPDATE user SET token = '" + newToken + "' WHERE iduser = " + userId;
		con.query(addKeyQuery, function (err) {
			if(err) throw err;
			res.json({yourToken: newToken, userId: userId, email: email});
		});
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
	jwt.verify(req.token, secretKey, (err,authData) => {
		if (err) return res.status(500).send({ auth: false, message: 'Failed to authenticate token.' });
		else {
			if(req.headers['userid'] == authData.id || req.headers.userid == authData.id){
				switch (action) {
				case 'NEW_POST':
					var sql = "INSERT INTO post (title, description, userid) VALUES('" +payload.title+ "', '"+payload.description+"', "+payload.userid+")";
					console.log('payload is:', payload);
					console.log('sql is: ', sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.status(200).json({message: 'created posts successfully', posts: result});
					});
					break;
				case 'SHOW_POSTS':
					sql = "SELECT * FROM post WHERE userid = " + payload.userid;
					console.log('sql for posts was:', sql);
					con.query(sql, function (err, result) {
						if (err) throw err;
						console.log('sql result was: ', JSON.stringify(result));
						res.status(200).json({message: 'retrieved posts successfully', posts: result});
					});
					break;
				case 'SHOW_FRIENDS': 
					sql = "SELECT * from user WHERE user.iduser = (SELECT friend FROM friendlist WHERE listowner = " + payload.userid + ")";
					con.query(sql, function (err, result) {
						if (err) throw err;
						res.status(200).json({message: 'retrieved friends successfully', friends: result});
					});
					break;
				case 'ADD_FRIEND':
					sql = "";
					///case add friend to list
					res.json({message: 'not a proper action'});
					break;
				case 'SHOW_COMMENTS':
					//case show comments for a post
					res.json({message: 'not a proper action'});
					break;
				case 'ADD_COMMENT':
					//case add a comment to a post
					res.json({message: 'not a proper action'});
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

