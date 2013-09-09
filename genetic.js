var _ = require("underscore");
var Genetic = function (params){
    var iteration = 0;
    var log = [];
    var winner = null;
    this.population = [];
    this.run = function (cycles) {
        var generations = [];
        log.push("Iteration: 1/" + cycles);
        log.push("Generate initial population");
        this.population = this.generatePopulation(params.populationSize);
        this.rate(this.population);
        winner = this.population.bestOne = this.select(this.population, 1)[0];
        generations.push(this.exportPopulation(this.population));

        for (var i = 1; i < cycles; i++) {
            iteration++;
            log.push("Iteration: " + (i+1) + "/" + cycles);
            console.log("Iteration: " + (i+1) + "/" + cycles);
            var oldPopulation = this.population;

            // najlepsze beda braly udzial w reprodukcji
            var bestSubjects = this.select(oldPopulation, params.reproductiveParents);

            var newSubjects = this.population = this.generatePopulation(params.newSubjects);

            // umiesc najlepsze osobniki w nowej populacji
            this.population = newSubjects.concat(this.select(bestSubjects, params.promotedParents));

            this.population.bestOne = this.select(bestSubjects, 1)[0];

            if(this.population.bestOne.rating > winner.rating) {
                winner = this.population.bestOne;
            }

            var subjectsLeft = oldPopulation.length - this.population.length;
            
            for (var j = 0; j < subjectsLeft; j++) {
                var subject = this.reproduce(bestSubjects);
                this.population.push(subject);
            }
            this.rate(this.population);
            if(i%10 === 0) {
                generations.push(this.exportPopulation(this.population));
            }

        }

        return {
            generations: generations,
            winner: winner
            //,log: log
        };
    };

    this.exportPopulation = function (population) {
        return _.map(population, function (item) {
            return {
                bestOne: item.bestOne,
                exceeded: item.exceeded,
                iteration: item.iteration,
                totalVolume: item.totalVolume,
                penalty: item.penalty,
                rating: item.rating
            }
        })
    };

    this.generatePopulation = function (size) {
        var population = [];
        for (var i = 0; i < size; i++) {
            var subject = this.generateSubject();
            subject.iteration = iteration; 
            population.push(subject);
        }

        return population;
    };

    this.generateSubject = function () {
        return params.subjectGenerator();
    };

    this.select = function (subjects, num) {
        return params.selector(subjects, num);
    };

    this.reproduce = function (parentSubjects) {

        // losuj rodzicow
        var parents = _.shuffle(parentSubjects).slice(0, 2);
        var child = params.reproductor(parents);
        this.evaluateSubject(child);

        log.push("Reproduce - paremts rating: " + parents[0].rating + ", " +  parents[1].rating + ", child: " + child.rating);        

        // czasami poddawaj mutacji
        if(Math.random() <= params.chanceOfMutation) {
            child = this.mutate(child);
        }
        child.iteration = iteration;         

        return child;
    }

    this.rate = function (subjects) {
        _.each(subjects, this.evaluateSubject, this);
    };

    this.evaluateSubject = function (subject) {
        return params.subjectEvaluator(subject);
    };

    this.mutate = function (subject) {
        this.evaluateSubject(subject);
        var mutated = params.subjectMutator(subject);
        this.evaluateSubject(mutated);
        log.push("Mutate - rating before:" + subject.rating + ", after: " + mutated.rating);
        
        return mutated;
    };
}

module.exports =  Genetic