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
    categoryConflictPenalty: 5,
    mutationTries: 5,
    chanceOfMutation:  0.5,

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
  		var subject = {solution: []};
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

                subject.solution.push({ 
                  shelve: shelve.id,
                  product: product
                });

                console.log('Put product: #' + product.id + ' on shelve: #' + shelve.id);
                shelve.capacity -= product.volume;
              } else {
                console.log("Product skipped. Not enough place");
              }
  			});
  		});
      subject.shelvesStatus = shelvesStatus;
  		return subject;
  	},

    // wybiera [num] najlepszych
    selector: function(subjects, num) {
      var sorted = _.sortBy(subjects, function (subject) {
        return subject.rating;
      });
      return subjects.slice(0, num);
    },

    reproductor: function (parents) {
      var a = parents[0],
          b = parents[1];

      return params.subjectGenerator(); // TODO
    },

    subjectMutator: function(subject) {

      for (var i=0; i < this.mutationTries; i++) {
      console.log(subject.shelvesStatus);
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
            
            console.log('Mutation success!');
            return subject;
        } else {
            console.log('Mutation try #' + i + ' failed.');
        }

      }

      console.log("Mutation tries failed.");
      return subject; // TODO
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
      subject.penalty = penalties * params.categoryConflictPenalty;
      subject.rating = subject.totalVolume - subject.penalty;
    }
  }

  genetic = new Genetic(params);

  var result = genetic.run(20);

  response.send('callback(' + JSON.stringify(result) + ');');
});

app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});