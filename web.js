var express = require("express");
var _ = require("underscore");
var inputData = require('./inputData.json');
var Genetic = require('./genetic.js');
var app = express();
var Utils = {
  randomKey: function(arr) {
    var key = Math.floor(Math.random() * arr.length);
    return key;
  }
};

app.get('/result.js', function(request, response) {
  var params = {
    populationSize: 10,
    reproductiveParents: 5,
    promotedParents: 2,
    newSubjects: 5,
    categoryConflictPenalty: 5,
    mutationTries: 5,
    chanceOfMutation:  0.1,
    exceededPenalty: 5,
    outputLimiter: 100, // wysw. co [n] iterację

    subjectGenerator: function() {
      var self = this;
      var shuffledDeliveries = _.shuffle(inputData.deliveries);
      var shelvesStatus = _.map(inputData.shelves, function(shelve) {
        return {
          id: shelve.id,
          capacity: shelve.capacity
        }
      });
      
      //generating subject
      var subject = {solution: [], exceeded: 0};
      console.log("New subject");

      // dla kazdego produktu dla kazdej
      // z dostaw sprobuj przyporzadkowac polke
      _.each(shuffledDeliveries, function(delivery) {
        _.each(delivery.products, function(productId) {
          
          var product = _.findWhere(inputData.products, { id: productId });
              // tylko polki z wystarczajaca iloscia wolnego miejsca
              sufficientShelves = _.filter(shelvesStatus, function(shelve){ return shelve.capacity >= product.volume });

              if(sufficientShelves.length > 0) {
                var key = Utils.randomKey(sufficientShelves);
                var shelve = sufficientShelves[key];

                product.uid = delivery.id + "_" + product.id;

                subject.solution.push({ 
                  shelve: shelve.id,
                  product: product
                });

                console.log('Put product: #' + product.id + ' on shelve: #' + shelve.id);
                shelve.capacity -= product.volume;
              } else {
                console.log("Not enough place");
                var key = Utils.randomKey(shelvesStatus);
                var shelve = shelvesStatus[key];

                subject.exceeded += product.volume - shelve.capacity; 

                product.uid = delivery.id + "_" + product.id;

                subject.solution.push({ 
                  shelve: shelve.id,
                  product: product
                });

                console.log('Put product: #' + product.id + ' on shelve: #' + shelve.id);
                shelve.capacity -= product.volume;
              }
        });
      });
      subject.shelvesStatus = shelvesStatus;
      return subject;
    },

    // wybiera [num] najlepszych
    selector: function(subjects, num) {
      var sorted = _.sortBy(subjects, function (subject) {
        return -subject.rating;
      });
      return sorted.slice(0, num);
    },

    reproductor: function (parents) {
      var a = parents[0],
          b = parents[1],
          c = {};

          var aHash = {},
              aUIDs = [],
              bHash = {}
              bUIDs = [];
          
          _.each(a.solution, function(item) {
            aUIDs.push(item.product.uid);
            aHash[item.product.uid] = item;
          });

          _.each(b.solution, function(item) {
            aUIDs.push(item.product.uid);
            bHash[item.product.uid] = item;
          });

          var half = Math.floor(aUIDs.length/2);

          var solution = [],
              exceeded = 0;

          for (var i = 0; i < half; i++) {
            solution.push(aHash[aUIDs[i]]);
          }

          for (var i = half; i < b.length; i++) {
            solution.push(bHash[bUIDs[i]]);
          }

          // ocen rozwiazanie & przygotuj nowy status polek
          var shelvesStatus = _.map(inputData.shelves, function(shelve) {
            return {
              id: shelve.id,
              capacity: shelve.capacity
            }
          });

          _.each(solution, function(item) {
            var shelve = _.findWhere(shelvesStatus, { id: item.shelve });
            if(shelve.capacity < item.product.volume) {
              exceeded += item.product.volume - shelve.capacity;
            }
            shelve.capacity -= item.product.volume;
          });

          //console.log("Repoducted, exceeded: " + exceeded);


          return {
            solution: solution,
            shelvesStatus: shelvesStatus,
            exceeded: exceeded
          }
    },

    subjectMutator: function(subject) {

      for (var i=0; i < this.mutationTries; i++) {
        var a = subject.solution[Utils.randomKey(subject.solution)],
            b = subject.solution[Utils.randomKey(subject.solution)],

            aShelve = _.findWhere(subject.shelvesStatus, {id: a.shelve}),
            bShelve = _.findWhere(subject.shelvesStatus, {id: b.shelve}),

            aShelveCapacity = aShelve.capacity + a.product.volume,
            bShelveCapacity = bShelve.capacity + b.product.volume 

        if (aShelveCapacity > b.product.volume && bShelveCapacity > a.product.volume) {
            var tmp = a.shelve;
            a.shelve = b.shelve;
            b.shelve = tmp;
            aShelve.capacity = aShelveCapacity - b.product.volume;
            bShelve.capacity = bShelveCapacity - a.product.volume;
            
            //console.log('Mutation success!');
            return subject;
        }
      }

      console.log("Mutation tries failed.");
      return subject;
    },
    subjectEvaluator: function(subject) {
      var totalVolume = 0,
          penalties = 0,
          shlevesCategories = {};
      _.each(subject.solution, function (item) {
        totalVolume += item.product.volume;

        if (shlevesCategories[item.shelve]) {
          if(!_.contains(shlevesCategories[item.shelve], item.product.category)) { 
            shlevesCategories[item.shelve].push(item.product.category);
          }
        } else { shlevesCategories[item.shelve] = [item.product.category] }
      });

       _.each(shlevesCategories, function (shelve) {
        _.each(inputData.constraints, function (constraint) {
            penalties +=  _.intersection(shelve, constraint).length - 1;
        });
      });

      subject.totalVolume = totalVolume;
      subject.penalty = penalties * params.categoryConflictPenalty + subject.exceeded * params.exceededPenalty;
      subject.rating = subject.totalVolume - subject.penalty;
    }
  }

  genetic = new Genetic(params);

  var result = genetic.run(1000);

  response.connection.setTimeout(0);
  response.send('callback(' + JSON.stringify(result) + ');');
});

app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});