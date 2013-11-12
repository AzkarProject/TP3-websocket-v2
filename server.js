var serverFramerate = 10000;

// We need to use the express framework: have a real web servler that knows how to send mime types etc.
var express=require('express');

// Init globals variables for each module required
var app = express()
  , http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);


// Indicate where static files are located  
// Externalisation de fichiers (js et css par exemple) 
app.configure(function () {    
    app.use(express.static(__dirname + '/'));    
});    
/**/

// launch the http server on given port
//Get the environment variables we need.
server.listen(8080);

// routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/MoteurDeJeux-v7.html');
});
/**/

// Méthodes communes client/serveur
var common = require('./common');

// usernames which are currently connected to the chat
var usernames = {};

// Listes
var listePlayers = {};

// Fonction de clonage
// Because le slice(0) ne fonctionne 
// pas sur un objet....
function clone(obj){
    var copy = JSON.parse(JSON.stringify(obj));
    return copy;
}

var listeObstacles = {};  


// Non fragmentables
listeObstacles[0] = new common.rectangle(350,200,100,100,1,1,false,common.createUUID());
listeObstacles[1] = new common.rectangle(350,200,100,100,1,1,false,common.createUUID());
listeObstacles[2] = new common.rectangle(350,200,100,100,-1,-1,false,common.createUUID());
listeObstacles[3] = new common.rectangle(100,100,20,20,3,10,false,common.createUUID());
listeObstacles[4] = new common.rectangle(75,0,30,100,10,0,false,common.createUUID());
listeObstacles[5] = new common.cercle(150,100,30,5,5,'blue','red',10,false,common.createUUID());
//listeObstacles[6] = new common.rectangle(350,200,100,100,1,1,false,common.createUUID());
/**/

/*// Fragmentables...
listeObstacles[0] = new common.rectangle(350,200,100,100,1,1,true,common.createUUID());
listeObstacles[1] = new common.rectangle(350,200,100,100,1,1,true,common.createUUID());
listeObstacles[2] = new common.rectangle(350,200,100,100,-1,-1,true,common.createUUID());
listeObstacles[3] = new common.rectangle(100,100,20,20,3,10,true,common.createUUID());
listeObstacles[4] = new common.rectangle(75,0,30,100,10,0,true,common.createUUID());
listeObstacles[5] = new common.cercle(150,100,30,5,5,'blue','red',10,false,common.createUUID());
listeObstacles[6] = new common.rectangle(350,200,100,100,1,1,true,common.createUUID());
/**/

// Sauvegarde du tableau d'obstacle de départ pour les resets...
var listeObstacleDepart = clone(listeObstacles);

var listeDebris = {};
var listObservers = {};

// Flags d'états coté serveur
var lockServerGameSession = false;

// Comptage des joueurs dans la liste
// Avec une boucle bien bourrin because le length fait un NaN sur un objet
var getNbPlayers = function(listePlayers){
   var nbPlayers = 0;
        for (var i in listePlayers) {
                    nbPlayers ++;
        }
    return nbPlayers;
}

// Idem pour les obstacles
var getNbObstacles = function(listeObstacles){
   var nbObstacles = 0;
        for (var i in listeObstacles) {
                    nbObstacles ++;
        }
    return nbObstacles;
}



// Messages 
//var canvasMessage =" GO >>>>> ";
var canvasMessage ="";
var welcomePlayer = "";
welcomePlayer = "Vous êtes inscrit comme pilote.\n";
welcomePlayer += "Vous pouvez lancer la course à tout moment...\n";
welcomePlayer += "Sinon départ automatique dès le 6ème inscrit.\n";
welcomePlayer += " \n";
welcomePlayer += " ------ Rêgles ------ \n";
welcomePlayer += "Objectif > Atteindre la cible...\n";
welcomePlayer += "Collisions > freeze conrôles > 10 secondes.\n";
welcomePlayer += "Sorties de piste > Retour à la grille de départ.\n";
welcomePlayer += " \n";
welcomePlayer += " ------ Couleurs ------ \n";
welcomePlayer += "Vous: vert - Autres pilotes: noir.\n";
welcomePlayer += "N° Dossart: Orange - Si Freeze temporaire: gris.";


var welcomeSpectateur = "";
welcomeSpectateur = "La course est dèjas partie...\n";
welcomeSpectateur += " >> Les inscriptions sont closes.\n";
welcomeSpectateur += "Toutefois, le tchat reste ouvert \n";
welcomeSpectateur += "et vous pouvez dialoguer avec les pilotes.\n";

var messageGameReOpen = "";
messageGameReOpen += "Les inscriptions sont réouvertes.\n";
messageGameReOpen += "Rechargez la page pour vous inscrire...\n";

var showScoresMessage = '';
var timerLoop;
var timerObstacles;


var startTime = 0;
// Initialisation 1er niveau
var level = new common.level();
level.number = 1;
level.endLevel = false;
level.chrono = 0;
level.type = "Niveau ";
var activeLevel = false;
//var maxLevels = getNbObstacles();
// Données du Canvas
var canvas ={};
canvas.id = 'myCanvas';
canvas.width='600';
canvas.height='400';

// Pour le compte a rebour
var secondeDecompte = 3;
var endDecompte = false; 
var timerDecompte;

var gameOver = true;

io.sockets.on('connection', function (socket) {

    // Fonction générique de message...
    // Marre de devoir différencier le client émeteur des autres...
    function sendMessage(message){
        socket.emit('updatechat', 'SERVER', message );
        socket.broadcast.emit('updatechat', 'SERVER', message);
    }    

    // Reset flag de vérouillage
    var reinitFlagsServer = function(){
      lockServerGameSession = false;
      // On met a jour les autres users
      io.sockets.emit('receiveLockServerGame', lockServerGameSession);
    };
  
    // Reset du jeu
    var reinitGame = function(isGameOver){
        startTime = 0;
        level.number = 1;
        level.endLevel = false;
        level.chrono = 0;
        level.type = "Niveau ";
        activeLevel = false;
        // Données du Canvas
        canvas ={};
        canvas.id = 'myCanvas';
        canvas.width='600';
        canvas.height='400';
        // Pour le compte a rebour
        secondeDecompte = 3;
        endDecompte = false; 
        var gameOver = true;
        io.sockets.emit('updateLevel',level);
        // effacement et recréation des obstacles...
        listeObstacles = {};
        listeObstacles = clone(listeObstacleDepart);
        // Réinit liste des joueurs
        listePlayers = {};
        io.sockets.emit('updatePlayers', listePlayers);
        // Suppression des débris...
        listeDebris = {};
        // Arret des boucles
        clearTimeout(timerLoop);
        clearTimeout(timerObstacles);
        io.sockets.emit('stopClientLoop');
        if ( oldScoreToShow = false ) {
          // message  messageGameOpen
          io.sockets.emit('updateCanvasGamer', messageGameReOpen);
        };
        io.sockets.emit('GameOverButton');
    };
   
    

    
    
    
    // Boucle de mise à jour obstacles...
    var stopTimerObstacles = false;
    var updateObstacles = function (){
         if (stopTimerObstacles == false){
         // io.sockets.emit('updateLevelMessage', canvasMessage,level ); 
         io.sockets.emit('receivedObstacles', listeObstacles);
         //io.sockets.emit('updatechat', 'SERVER','>>> OBSTACLES...');
         }
         if (stopTimerObstacles == true){
            clearTimeout(timerObstacles);
         }
         //timerObstacles = setTimeout(updateObstacles , 1000/60 );
         timerObstacles = setTimeout(updateObstacles , serverFramerate );
    }
    
    // Compte a rebour
    var compteARebour = function (){
        if (endDecompte == false ) {
            if(secondeDecompte <= 1) {pl = "";
          } else {
            pl = "s";
          }
        var message = "Départ dans " +secondeDecompte + " seconde" + pl;
        if(secondeDecompte == 0 || secondeDecompte < 0) {
            secondeDecompte = 0;
            message = "Niveau "+level.number+" - GO >>>>>";
            clearTimeout(timerDecompte);
            // Le clearTimeout etant capricieux:
            // je rajoute un test d'état...            
            endDecompte = true;
            // Démmarage des boucles
            stopTimerObstacles == false;
            setTimeout(updateObstacles);
            io.sockets.emit('startClientLoop');
            serverLoop(); 
          }
          //exports.writeMessage(message);
          io.sockets.emit('updateCanvasMessage', message);
          secondeDecompte--;
       if (showScoresMessage !='') {
        io.sockets.emit('updateCanvasGamer', showScoresMessage);
        }
       }
       timerDecompte = setTimeout(compteARebour,1000);
     };   
      
    // Lancement de niveau
    var serverStartLevel = function() {
       
       // Arret des boucles...
       clearTimeout(timerDecompte);
       clearTimeout(timerLoop);
       stopTimerObstacles == true;
       clearTimeout(timerObstacles);
       // io.sockets.emit('clearScreen'); 
      
       // Remise à zéro Message de score...
       showScoresMessage  = "";
       
       // Si le jeu est en cours...
       if ( lockServerGameSession == true ) {
          var maxLevels = getNbObstacles(listeObstacles);
          // on check si c'est le dernier niveau...
          var endGame = false;
          if (level.number > maxLevels) endGame = true;
          if (endGame == true) {
              var endMessage = "GAME OVER";
              var finalMessage = common.server_showScores(listePlayers,startTime,level,endMessage);
              io.sockets.emit('updateCanvasGamer', finalMessage);
              reinitFlagsServer();
              var oldScoreToShow = true;
              reinitGame(oldScoreToShow);
          } else {
            if (startTime != 0 ) {
              // Message de classement intermédiaire
              showScoresMessage = common.server_showScores(listePlayers,startTime,level);
              }  
            // On vire les débris de la piste
            listeDebris = {};
            startTime = 0;
            activeLevel = true;
            gameOver = false;
            secondeDecompte = 3;
            endDecompte = false;
            //setInterval(compteARebour,1000)
            compteARebour();
          }
      
        }
          
          } // ----------- End StartLevel 
    
    
    // Loop de synchro coté serveur
    var serverLoop = function(){
            
        if ( lockServerGameSession == true ) {
              //Tests
              // io.sockets.emit('updateCanvasMessage', canvasMessage);
              // io.sockets.emit('updateCanvasArea', messsage);  // marche po...
              // io.sockets.emit('updatechat', 'SERVER',canvasMessage);
              if(startTime == 0) startTime = new Date();
              
              level.endLevel = true;// Valeur par défaut, false..
              var levelToMacth = level.number;
              for (joueur in listePlayers){
                  if (listePlayers[joueur].level < levelToMacth){
                     level.endLevel = false;
                     break;
                  }
                } 
              
              // Si fin de niveau
              if (level.endLevel == true) { 
                      
                      // On stoppe les boucles coté serveur 
                      clearTimeout(timerLoop);
                      stopTimerObstacles == true;
                      clearTimeout(timerObstacles);
                      
                      // On informe les clients
                      io.sockets.emit('stopClientLoop');
                      io.sockets.emit('updateLevelMessage', "Ternimé", level);
                      io.sockets.emit('clearScreen');
                      
                      // On incrémente et réinitialise le niveau
                      
                      level.number += 1 ;
                      level.endLevel = false;
                      io.sockets.emit('updateLevel',level);
                      
                      
                      // Pour chaque joueur
                      // On réinitialise certains elements des joueurs
                      // Lesvitesses et les freeze par exemple...
                      for (joueur in listePlayers){
                          listePlayers[joueur].vitesseX = 0; listePlayers[joueur].vitesseY = 0;
                          listePlayers[joueur].lastTimeCollision = 99999;
                          listePlayers[joueur].active = true;
                          listePlayers[joueur].isFreeze = false;
                       }
                       /**/
    
                       // On met les joueurs à leur pole position...
                       var nbJoueurs = getNbPlayers(listePlayers);
                       common.startPolePosition (canvas,listePlayers,nbJoueurs,level);
                       
                       // On rebalance aux clients les joueurs modifiés
                       io.sockets.emit('updatePlayers', listePlayers);
                       
                       // On vire les débris de la piste
                       listeDebris = {};
                       
                       // On remet tous les obstacles en mode visible
                       for (obstacle in listeObstacles){
                          listeObstacles[obstacle].visible = true;
                       }
                       
                       // flag de boucle a false
                       activeLevel = false;
            }
            
            
            // Si pas fin de niveau, on boucle...
            if (activeLevel == true){
              
              common.server_drawObstacles(listeObstacles,canvas,level);
            
              common.server_drawDebris(listeDebris,canvas);
              
              stopTimerObstacles == false;
              // timerLoop = setTimeout(serverLoop,1000/60);
  
            // Sinon, on lance le niveau suivant..
            } else {
                  //io.sockets.emit('updatechat', 'SERVER',' Niveau ');
                  clearTimeout(timerLoop);
                  stopTimerObstacles == true;
                  clearTimeout(timerObstacles);
                  // io.sockets.emit('updateCanvasMessage', 'serveLoop > serverStartLevel()');
                  if (gameOver == false) serverStartLevel();
            }; 
            timerLoop = setTimeout(serverLoop,1000/60);
          
        }
    };
       /**/  
    

    
    // Demande client de la liste des obstacles...
    socket.on('getListObstacles', function(){
      io.sockets.emit('receivedObstacles', listeObstacles);
    });
    
    
    // Demande client des flags serveurs...
    socket.on('getLockGame', function(){
       io.sockets.emit('receiveLockServerGame', lockServerGameSession);
    }); 
    
    
    
    // Demande client d'un player à enregistrer.
	  socket.on('addPlayer',function(player,maxPlayers,lockGameSession){
    
        // test fonctions communes 
        //var test123 = common.test();
        //sendMessage(test123);
        //sendMessage(canvasMessage);

        // comptage du nombre de coureurs
        var nbPlayers = getNbPlayers (listePlayers);
        player.number = nbPlayers+1;
        
        // Si plus de joueurs, on remet les etats de jeu à true...
        if ( nbPlayers == 0 ) {
              reinitGame
              reinitFlagsServer();
              }
        var isSpectateur = false;
        
        if ( nbPlayers == maxPlayers 
             || lockGameSession == true
             || lockServerGameSession == true
            ) {
          isSpectateur = true;
          var message = 'Inscriptions Course closes !';
          socket.emit('updatechat', 'SERVER', message );
          socket.broadcast.emit('updatechat', 'SERVER', message);  
        }
        
        // On l'inscrit dans la course
        if ( isSpectateur == false) {
          var playerKey =  "("+player.number+") "+player.name;
          // we store the player in the socket session for this client
      		socket.player = playerKey;
      		// Pour eviter les prompts fantômes
          player.isRegistered = true; 
          player.isSpectateur = false; 
          // Ajout du client a la liste des joueurs
          listePlayers[playerKey] = player;
      		// echo to client they've connected
      		socket.emit('updatechat', 'SERVER', 'VOUS êtes '+ player.name );
      		// echo globally (all clients) that a person has connected
      		socket.broadcast.emit('updatechat', 'SERVER', player.name + ' en piste');
      		// update the list of players in game, client-side
          io.sockets.emit('updatePlayers', listePlayers);
          // Message welcomePlayer
          socket.emit('updateCanvasGamer', welcomePlayer);
        
        // Sinon on l'inscrit sur le tchat
        } else {
          // we store the username in the socket session for this client
      		socket.username = player.name;
          // Pour eviter les prompts fantômes
          player.isRegistered = true; // 
          player.isSpectateur = true;          
      		// add the client's username to the global list
      		usernames[player.name] = player.name;
      		// echo to client they've connected
      		socket.emit('updatechat', 'SERVER', 'Vous êtes connecté');
      		// echo globally (all clients) that a person has connected
      		socket.broadcast.emit('updatechat', 'SERVER', player.name + ' connecté');
      		// update the list of users in chat, client-side
      		io.sockets.emit('updateusers', usernames);
          // message  welcomeSpectateur
          socket.emit('updateCanvasGamer', welcomeSpectateur);
        }
    	 }); 
                  
  
      // Idem sendPlayersMoves en version objet
      // TODO a virer une foi le sendPlayerClient opérationnel 
      // On le reçoit en boucle toutes les 15 milisecondes...
      socket.on('senpPlayerMovesObject',function(moveObject){ 
        socket.broadcast.emit('updateMoves',moveObject);
      });

      
      // idem sendPlayerMoveObjects, mais avec l'objet Client complet...
      socket.on('sendClientPlayer',function(clientPlayer){
          listePlayers[socket.player] = clientPlayer;
          socket.broadcast.emit('updateMoves',clientPlayer);
      });
      
      
      
     // TODO obsolète ? 
     // Envoi client de sa liste d'obstacles
     socket.on('sendPlayerObstacles',function(listObject){ 
          // Maintenant, reste plus qu'à
          // -- > Attendre la reception de tous les joueurs
          // -- > Un fois tous recut, comparer
          // et mettre a jour l'ensemble de la liste...
          // 1 : Con crée une liste temporaire
          // On compare les obstacles 1 par un..
          for ( object in listObject) {
               //var toto = listObject[object];
               //sendMessage(toto.x);
               for ( obstacle in listeObstacles) {
                   //sendMessage(listObject[object].idUnique);
                   if  (listeObstacles[obstacle].idUnique == listObject[object].idUnique) {
                        listeObstacles[obstacle] = listObject[object];
                      //sendMessage(listeObstacles[obstacle].idUnique);
                   }
                   /**/
               }
               
          }
          io.sockets.emit('receivedObstacles', listeObstacles);
     });
     /**/
    
       

     // Envoi client de sa liste de débris
     socket.on('sendPlayerDebris',function(listObject){ 
          for ( object in listObject) {
               //var toto = listObject[object];
               //sendMessage(toto.x);
               var isExist = false;
               var cpt = 0;
               for ( i in listeDebris) {
                    // On teste s'il est présent ou pas 
                    // Si présent, on le met a jour
                    if  (listeDebris[i].idUnique == listObject[object].idUnique) {
                      listeDebris[i] = listObject[object];
                      isExist = true;
                    };
                    cpt++;
               };
               // Si pas présent, on l'ajoute... 
               if ( isExist == false) {
                   listeDebris[cpt] = listObject[object];
               };
               
          }
          // Et on renvoie a liste a tous les joueurs...
          io.sockets.emit('receivedDebris', listeDebris);
     });
    
    
    // TODO >>> Vérifier si utilisé...
    // when the client emits 'updatePlayerDistant', this listens and executes
	  socket.on('updatePlayerDistant',function(player){
        listePlayers[i] = player ;
    }); 
                  
   // TODO >>> Vérifier si utilisé...
   // Demande client de la liste des pilotes (players) ...
   socket.on('getListPlayers', function(){
      io.sockets.emit('receiveUpdatedPlayers', listePlayers);
    
    });
    
   // TODO >>>> Vérifier si utilisé...
   // Demande client de la liste des spectateurs (users) ...
   socket.on('getSpectateursListPlayers', function(){
      io.sockets.emit('updatePlayersForSpectateurs', listePlayers);
    });
    
    
   // TODO >>>> Vérifier si utilisé...
   // Demande client du nombre de joueurs inscrits
   socket.on('getNbPlayers', function(){
      var nbPlayers = getNbPlayers (listePlayers);
      io.sockets.emit('updateNbPlayers', nbPlayers);
    }); 
    
   
   // Envoi client d'un flag de verouillage
   socket.on('sendLockGame', function(lockGameSession) {
      lockServerGameSession = lockGameSession;
      // socket.emit('updatechat', 'SERVER', 'session verouillée');
      sendMessage( socket.player +' a fermé les inscriptions et lancé la course');
      // On rebalance le flag a tt le monde...
      io.sockets.emit('updateLockServerGame', lockServerGameSession);
      // Lancement du StartLevel  serveur
      serverStartLevel();
      
   }); 
  
   // Demande client nettoyage des débris
   socket.on('clearDebris', function() { 
       listeDebris = {};
   });
  
  
  // Envoi client d'un message chat
	socket.on('sendchat', function (data) {
    var whoIsTalking = "?";
    if (socket.username) whoIsTalking = socket.username;
    else if (socket.player) whoIsTalking = socket.player;
		io.sockets.emit('updatechat', whoIsTalking, data);
	});

  // Envoi client d'un message général en bandeau... 
  socket.on('sendCanvasMessage', function (message) {
    canvasMessage = message;
    io.sockets.emit('updateCanvasMessage', canvasMessage);
  });
	
  // A chaque déconnection détectée
	socket.on('disconnect', function(){
		if (socket.username){
      // remove the username from global usernames list
  		delete usernames[socket.username];
      // update list of users in chat, client-side
  		io.sockets.emit('updateusers', usernames);
      // echo globally that this client has left
  		socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' déconnecté');
    }
	
    // Add titi >>> Delete player
    // Si bien sur c'est un joueur et pas juste un user
    if (socket.player) {
      delete listePlayers[socket.player];
      // On verifie le nombre de joueurs
      // Et si zero, on réinitialise le flag de verouillage...
      // Et on remet le tableau d'obstacle a son état d'origine... 
      var nbPlayers = getNbPlayers (listePlayers);
      if ( nbPlayers == 0 ) {
        var oldScoreToShow = false;
        reinitFlagsServer();
        reinitGame(oldScoreToShow);
        /*
        // effacement et recréation des obstacles...
        listeObstacles = {};
        listeObstacles = clone(listeObstacleDepart);
        // Suppression des débris...
        listeDebris = {};
        // message  messageGameOpen
        io.sockets.emit('updateCanvasGamer', messageGameReOpen);
        io.sockets.emit('GameOver');
        clearTimeout(timerLoop);
        clearTimeout(timerObstacles);
        /**/
        }
      // Udpate liste des joueurs
      io.sockets.emit('updatePlayers', listePlayers);
  		socket.broadcast.emit('updatechat', 'SERVER', socket.player + ' quitte la course');
    }
  
  });
  
 
});