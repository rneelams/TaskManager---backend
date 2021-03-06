const express = require("express");
const app = express();

const { mongoose } = require("./db/mongoose");

const bodyParser = require("body-parser");

//Load in the mongoose models
const { List, Task, User } = require("./db/models");

// Load Middleware
app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header(
    "Access-Control-Allow-methods",
    "GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS"
  );
  next();
});

// verify refresh token middleware (which will be verifying the session )

let verifySession = (req, res, next) => {
  let refreshToken = req.header("x-refresh-token");

  let _id = req.header("_id");

  User.findByIdAndToken(_id, refreshToken)
    .then(user => {
      if (!user) {
        return Promise.reject({
          error:
            "User not found. Make sure that the refresh token and userid are correct"
        });
      }
      req.user_id = user._id;
      req.refreshToken = refreshToken;
      req.userObject = user;

      let isSessionValid = false;

      user.sessions.forEach(session => {
        if (session.token === refreshToken) {
          if (user.hasRefreshTokenExpired(session.expiresAt) === false) {
            isSessionValid = true;
          }
        }
      });
      if (isSessionValid) {
        next();
      } else {
        return Promise.reject({
          error: "Refresh token has expired or the session is invalid"
        });
      }
    })
    .catch(e => {
      res.status(401).send(e);
    });
};

// MIDDLE WARE

// verify refresh token middle ware

// ROUTE HANDLERS

// LIST ROUTES

/*
 * GET / Lists
 * Purpose: Get all lists
 */
app.get("/lists", async (req, res) => {
  // We want to return an array of all the lists in the database
  List.find({}).then(lists => {
    res.send(lists);
  });
});

/*
 * POST/lists
 * Purpose: Create a list
 */

app.post("/lists", async (req, res) => {
  // We want to create a new list and return the new list document back to the user (which includes the id)
  // The list info (fields) will be passed in via the json request body

  let title = req.body.title;

  let newList = new List({
    title
  });

  newList.save().then(listDoc => {
    // the full list document is required( including id)
    res.send(listDoc);
  });
});

/*
 * PATH/lists/:id
 * Purpose: Update a specified list
 */

app.patch("/lists/:id", (req, res) => {
  // We want to update the specific list (list document with id in the URL ) with the new values specified in the json body request
  List.findOneAndUpdate(
    { _id: req.params.id },
    {
      $set: req.body
    }
  ).then(() => {
    res.send({ message: "Updated succesfully." });
  });
});

/*
 * DELETE/lists/:id
 * Purpose: Delete a list
 */

app.delete("/lists/:id", (req, res) => {
  // we want to delete the specified list (document with id in the URl)
  List.findOneAndRemove({
    _id: req.params.id
  }).then(removedListDoc => {
    res.send(removedListDoc);
  });
});

app.get("/lists/:listId/tasks", (req, res) => {
  // we want to return all the tasks that belong to a specific list (specified by listed)
  Task.find({
    _listId: req.params.listId
  }).then(tasks => {
    res.send(tasks);
  });
});

// app.get("/lists/:listId/tasks/:taskId", (req, res) => {
//   task
//     .findOne({
//       _id: req.params.taskId,
//       _listId: req.params.listId
//     })
//     .then(task => {
//       res.send(task);
//     });
// });

app.post("/lists/:listId/tasks", (req, res) => {
  // we want to create a new task in a list specified by ListId

  let newTask = new Task({
    title: req.body.title,
    _listId: req.params.listId
  });
  newTask.save().then(newTaskDoc => {
    res.send(newTaskDoc);
  });
});

app.patch("/lists/:listId/tasks/:taskId", (req, res) => {
  Task.findOneAndUpdate(
    {
      _id: req.params.taskId,
      _listId: req.params.listId
    },
    {
      $set: req.body
    }
  ).then(() => {
    res.send({ message: "updated succesfully" });
  });
});

app.delete("/lists/:listId/tasks/:taskId", (req, res) => {
  Task.findOneAndRemove({
    _id: req.params.taskId,
    _listId: req.params.listId
  }).then(removedTaskDoc => {
    res.send(removedTaskDoc);
  });
});

// User routes

app.post("/users", (req, res) => {
  // user signup

  let body = req.body;
  let newUser = new User(body);

  newUser
    .save()
    .then(() => {
      return newUser.createSession();
    })
    .then(refreshToken => {
      return newUser.generateAccessAuthToken().then(accessToken => {
        return { accessToken, refreshToken };
      });
    })
    .then(authTokens => {
      res
        .header("x-refresh-token", authTokens.refreshToken)
        .header("x-access-token", authTokens.accessToken)
        .send(newUser);
    })
    .catch(e => {
      res.status(400).send(e);
    });
});

app.post("/users/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password)
    .then(user => {
      return user
        .createSession()
        .then(refreshToken => {
          return user.generateAccessAuthToken().then(accessToken => {
            return { accessToken, refreshToken };
          });
        })
        .then(authTokens => {
          res
            .header("x-refresh-token", authTokens.refreshToken)
            .header("x-access-token", authTokens.accessToken)
            .send(user);
        });
    })
    .catch(e => {
      res.sendStatus(400).send(e);
    });
});

app.get("/users/me/access-token", verifySession, (req, res) => {
  req.userObject
    .generateAccessAuthToken()
    .then(accessToken => {
      res.header("x-access-token", accessToken).send({ accessToken });
    })
    .catch(e => {
      res.status(400).send(e);
    });
});

app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
