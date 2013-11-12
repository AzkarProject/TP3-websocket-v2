
// Juste pour tester si le js est bien apellé...
function testutils() {
    alert ('utils.js > testutils()');
  }

// Equivalent du Var_Dump
// Source : http://trioniclabs.com/2012/09/javascript-var_dump-equivalent/  
function ObjectDump(obj, name) {
  this.result = "[ " + name + " ]\n";
  this.indent = 0;
 
  this.dumpLayer = function(obj) {
    this.indent += 2;
 
    for (var i in obj) {
      if(typeof(obj[i]) == "object") {
        // alert ('typeof(obj[i]) == "object"'));
        this.result += "\n" +
          "              ".substring(0,this.indent) + i +
          ": " + "\n";
        this.dumpLayer(obj[i]);
      
      } else {
        this.result +=
          "              ".substring(0,this.indent) + i +
          ": " + obj[i] + "\n";
      }
    }
 
    this.indent -= 2;
  }
 
  this.showResult = function() {
    /*
    var pre = document.createElement('pre');
    pre.innerHTML = this.result;
    document.body.appendChild(pre);
    /**/
    alert(this.result);
  }
 
  this.dumpLayer(obj);
  this.showResult();
}

// Trier un tableau d'objets 
// Source : // http://www.atinux.fr/2011/11/19/trier-un-tableau-d-objets-javascript/
// sortHashTable prend en paramètres :
// - le tableau d’objets
// - la clé par laquelle on va trier le tableau
// - [OPTIONNEL] Un booléen égal à true si on veut supprimer ou non la clé qui nous permet de trier.
// - Exemple sortHashTable(listeJoueurs, number, false);
function sortHashTable(hashTable, key, removeKey) {
    hashTable = (hashTable instanceof Array ? hashTable : []);
    var newHashTable = hashTable.sort(function (a, b) {
        return (typeof(a[key]) === 'number' ?  a[key] - b[key] : a[key] > b[key]);
    });
    if (removeKey) {
        for (i in newHashTable) {
            delete newHashTable[i][key];
        }
    }
    return newHashTable;
}

// Récupérer la clef la plus haute d'un tableau
// - le tableau d’objets
// - la clé numérique max que l'on veut récupérer
// - Exemple  getMaxKey(listeJoueurs, number) ;
function getMaxKey(hashTable, key) {
     var keyReturn = 0;
     for (i in hashTable) {
            if ( hashTable[i][key] > keyReturn ) keyReturn = hashTable[i][key];
        }
     return keyReturn;
}