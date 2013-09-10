var express = require("express");
var _ = require("underscore");
var Genetic = require('./genetic.js');
var app = express();
var Utils = {
  randomKey: function(arr) {
    var key = Math.floor(Math.random() * arr.length);
    return key;
  }
};

app.get('/result.json', function(request, response) {
  var req = request.query;
  var inputData = req.inputData;

  var params = {
    populationSize: Number(inputData.params.populationSize),
    reproductiveParents: Number(inputData.params.reproductiveParents),
    promotedParents: Number(inputData.params.promotedParents),
    newSubjects: Number(inputData.params.newSubjects),
    categoryConflictPenalty: Number(inputData.params.categoryConflictPenalty),
    mutationTries: Number(inputData.params.mutationTries),
    chanceOfMutation:  Number(inputData.params.chanceOfMutation),
    exceededPenalty: Number(inputData.params.exceededPenalty),
    outputLimiter: Math.floor(req.cycles / Number(inputData.params.outputLimit)) || 1, // wysw. max x iteracji

    subjectGenerator: function() {
      var self = this;
      var shuffledDeliveries = _.shuffle(inputData.deliveries);
      var shelvesStatus = _.map(inputData.shelves, function(shelve) {
        return {
          id: shelve.id,
          capacity: Number(shelve.capacity)
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
              sufficientShelves = _.filter(shelvesStatus, function(shelve){ return Number(shelve.capacity) >= Number(product.volume) });

              if(sufficientShelves.length > 0) {
                var key = Utils.randomKey(sufficientShelves);
                var shelve = sufficientShelves[key];

                product.uid = delivery.id + "_" + product.id;

                subject.solution.push({ 
                  shelve: shelve.id,
                  product: product
                });

                console.log('Put product: #' + product.id + ' on shelve: #' + shelve.id);
                shelve.capacity -= Number(product.volume);
              } else {
                console.log("Not enough place");
                var key = Utils.randomKey(shelvesStatus);
                var shelve = shelvesStatus[key];

                subject.exceeded += Number(product.volume) - Number(shelve.capacity); 

                product.uid = delivery.id + "_" + product.id;

                subject.solution.push({ 
                  shelve: shelve.id,
                  product: product
                });

                console.log('Put product: #' + product.id + ' on shelve: #' + shelve.id);
                shelve.capacity -= Number(product.volume);
              }
        });
      });
      subject.shelvesStatus = shelvesStatus;
      return subject;
    },

    // wybiera [num] najlepszych
    selector: function(subjects, num) {
      var sorted = _.sortBy(subjects, function (subject) {
        return -1 * Number(subject.rating);
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
              capacity: Number(shelve.capacity)
            }
          });

          _.each(solution, function(item) {
            var shelve = _.findWhere(shelvesStatus, { id: item.shelve });
            if(Number(shelve.capacity) < Number(item.product.volume)) {
              exceeded += Number(item.product.volume) - Number(shelve.capacity);
            }
            shelve.capacity -= Number(item.product.volume);
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

            aShelveCapacity = Number(aShelve.capacity) + Number(a.product.volume),
            bShelveCapacity = Number(bShelve.capacity) + Number(b.product.volume) 

        if (aShelveCapacity > Number(b.product.volume) && bShelveCapacity > Number(a.product.volume)) {
            var tmp = a.shelve;
            a.shelve = b.shelve;
            b.shelve = tmp;
            aShelve.capacity = aShelveCapacity - Number(b.product.volume);
            bShelve.capacity = bShelveCapacity - Number(a.product.volume);
            
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
        totalVolume += Number(item.product.volume);

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

  var result = genetic.run(req.cycles);

  response.connection.setTimeout(0);
  response.send(JSON.stringify(result));
});
app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});