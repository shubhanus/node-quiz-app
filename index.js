"use strict";

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _express = require("express");

var _express2 = _interopRequireDefault(_express);

var _http = require("http");

var _http2 = _interopRequireDefault(_http);

var _socket = require("socket.io");

var _socket2 = _interopRequireDefault(_socket);

var _timers = require("timers");

var _os = require("os");

var _questions = require("./questions");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var app = (0, _express2.default)();
var server = _http2.default.Server(app);
var io = new _socket2.default(server);
var port = process.env.PORT || 9009;

var users = {};
var userSockets = {};
var onGoingMatch = {};
app.use(_express2.default.static(__dirname + "/node_modules"));
app.get("/", function (req, res, next) {
  res.sendFile(__dirname + "/index.html");
});

server.listen(port);
console.log("Server running on " + port);

io.on("connection", function (socket) {
  // io.sockets.emit("users_list", users);
  console.log("client connected");
  socket.on("create_user", function (data, cb) {
    if (data) {
      // console.log("create_user called: ", data);
      socket.userName = data.name;
      users = _extends({}, users, _defineProperty({}, data.name, _extends({}, data, {
        availablity: true
      })));
      userSockets[data.name] = socket;
    }
    cb(true);
    console.log("game_list");
    io.sockets.emit("game_list", users);
  });

  socket.on("get_gameList", function (data, cb) {
    cb(users);
  });

  socket.on("user_select", function (_ref, cbb) {
    var _score;

    var userName = _ref.userName,
        playerName = _ref.playerName;

    var match_id = new Date().getTime().toString();
    // console.log(userName, " : vs : ", playerName);
    userSockets[playerName] = socket;

    socket.match_id = match_id;
    userSockets[userName].match_id = match_id;
    socket.opponentName = userName;

    socket.userName = playerName;
    userSockets[userName].opponentName = playerName;

    socket.join(match_id);
    userSockets[userName].join(match_id);

    console.log("room joined");
    var randQues = _questions.MockData.sort(function () {
      return 0.5 - Math.random();
    }).slice(0, 6);
    io.to(match_id).emit("get_ready", {
      challenger: socket.userName,
      opponent: playerName,
      matchStartTime: 5,
      quesList: randQues
    });
    onGoingMatch = _extends({}, onGoingMatch, _defineProperty({}, match_id, {
      _id: match_id,
      users: {
        challenger: socket.userName,
        opponent: userName
      },
      quesList: randQues,
      score: (_score = {}, _defineProperty(_score, socket.userName, {
        current_ball: 0,
        over_summary: [],
        total_score: 0,
        wickets: 0
      }), _defineProperty(_score, userName, {
        current_ball: 0,
        over_summary: [],
        total_score: 0,
        wickets: 0
      }), _score),
      results: {}
    }));
    // console.log("timer sent");
  });

  socket.on("hit", function (data) {
    // console.log(
    //   "Initial Ball: ",
    //   onGoingMatch[socket.match_id].score[socket.userName].current_ball,
    //   onGoingMatch[socket.match_id].score[socket.opponentName].current_ball
    // );

    onGoingMatch[socket.match_id].score[socket.userName].current_ball += 1;
    onGoingMatch[socket.match_id].score[socket.userName].over_summary.push(data.hit);
    if (data.hit != "wk") {
      onGoingMatch[socket.match_id].score[socket.userName].total_score += data.hit;
    } else {
      onGoingMatch[socket.match_id].score[socket.userName].wickets += 1;
    }
    // console.log("entry saved as: " + data.hit + " for " + socket.userName);
    // console.log(userSockets[socket.opponentName]);
    userSockets[socket.opponentName].emit("opp_score", {
      wickets: onGoingMatch[socket.match_id].score[socket.userName].wickets,
      runs: onGoingMatch[socket.match_id].score[socket.userName].total_score,
      balls: onGoingMatch[socket.match_id].score[socket.userName].current_ball
    });
    if (onGoingMatch[socket.match_id].score[socket.userName].current_ball == onGoingMatch[socket.match_id].score[socket.opponentName].current_ball && onGoingMatch[socket.match_id].score[socket.opponentName].current_ball < 6 && onGoingMatch[socket.match_id].score[socket.userName].current_ball < 6) {
      if (data.state == "time_over") {
        io.to(socket.match_id).emit("next_ball");
      } else {
        (0, _timers.setTimeout)(emitNextBall, 1000);
      }
      console.log("next ball call emitted");
    } else if (onGoingMatch[socket.match_id].score[socket.userName].current_ball == onGoingMatch[socket.match_id].score[socket.opponentName].current_ball && onGoingMatch[socket.match_id].score[socket.opponentName].current_ball == 6 && onGoingMatch[socket.match_id].score[socket.userName].current_ball == 6) {
      // console.log(
      //   "Ball 6: ",
      //   onGoingMatch[socket.match_id].score[socket.userName].current_ball,
      //   onGoingMatch[socket.match_id].score[socket.opponentName].current_ball
      // );
      console.log("Match Over");
      userSockets[socket.opponentName].emit("match_over", {
        score: {
          you: onGoingMatch[socket.match_id].score[socket.opponentName],
          opponent: onGoingMatch[socket.match_id].score[socket.userName]
        }
      });
      socket.emit("match_over", {
        score: {
          you: onGoingMatch[socket.match_id].score[socket.userName],
          opponent: onGoingMatch[socket.match_id].score[socket.opponentName]
        }
      });
      userSockets[socket.opponentName].leave(socket.match_id);
      socket.leave(socket.match_id);
      onGoingMatch = {};
      userSockets = {};
      users = {};
    }
    //  else if (
    //   onGoingMatch[socket.match_id].score[socket.opponentName].current_ball >=
    //     7 &&
    //   onGoingMatch[socket.match_id].score[socket.userName].current_ball >= 7
    // ) {
    //   io.to(socket.match_id).emit("match_over", onGoingMatch[socket.match_id]);
    // }
  });

  socket.on("player_left_room", function () {
    console.log("client left room");
    if (socket.match_id) {
      // console.log("player left room emmited");
      socket.leave(socket.match_id);
      if (userSockets[socket.opponentName]) {
        userSockets[socket.opponentName].emit("player_left");
        // console.log("inside inner if");
        userSockets[socket.opponentName].leave(socket.match_id);
      }

      userSockets = {};
      users = {};
      onGoingMatch = {};
    }
    // userSockets = {};
    // users = {};
    // onGoingMatch = {};
  });

  socket.on("disconnect", function () {
    console.log("client disconnected");
    if (socket.match_id) {
      // console.log("player left emmited");
      // io.to(socket.match_id).emit("player_left");
      socket.leave(socket.match_id);
      if (userSockets[socket.opponentName]) {
        // console.log("inside inner if");
        userSockets[socket.opponentName].leave(socket.match_id);
      }

      userSockets = {};
      users = {};
      onGoingMatch = {};
    }
    // userSockets = {};
    // users = {};
    // onGoingMatch = {};
  });
  function emitNextBall() {
    // console.log({
    //   wickets: onGoingMatch[socket.match_id].score[socket.opponentName].wickets,
    //   runs: onGoingMatch[socket.match_id].score[socket.opponentName].total_score
    // });
    io.to(socket.match_id).emit("next_ball");
  }
});