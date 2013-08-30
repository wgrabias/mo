var _ = require("underscore");
var Genetic = function (params){
	this.population = [];
	this.run = function (cycles) {
		var generations = [];
		console.log("Generate initial population");
		this.population = this.generatePopulation(params.populationSize);
		this.rate(this.population);
		generations.push(this.population);

		for (var i = 1; i < cycles; i++) {
			console.log("Iteration: " + i + "/" + cycles);
			var oldPopulation = this.population;

			// najlepsze beda braly udzial w reprodukcji
			var bestSubjects = this.select(oldPopulation, params.reproductiveParents);

			// umiesc najlepsze osobniki w nowej populacji
			this.population = this.select(bestSubjects, params.promotedParents);

			var subjectsLeft = oldPopulation.length - this.population.length;
			console.log("left: " + subjectsLeft);
			for (var j = 0; j < subjectsLeft; j++) {
				var subject = this.reproduce(bestSubjects);
				this.population.push(subject);
			}
			this.rate(this.population);
			generations.push(this.population);
		}

		return {
			generations: generations
		};
	}

	this.generatePopulation = function (size) {
		var population = [];
		for (var i = 0; i < size; i++) {
			var subject = this.generateSubject();
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
		console.log("Reproduce");

		// losuj rodzicow
		var parents = _.shuffle(parentSubjects).slice(0, 2);
		var child = params.reproductor(parents);
		
		// czasami poddawaj mutacji
		if(Math.random() <= params.chanceOfMutation) {
			child = this.mutate(child);
		}
		
		return child;
	}

	this.rate = function (subjects) {
		_.each(subjects, this.evaluateSubject, this);
	};

	this.evaluateSubject = function (subject) {
		return params.subjectEvaluator(subject);
	};

	this.mutate = function (subject) {
		console.log("Mutate");
		return params.subjectMutator(subject);
	};
}

module.exports =  Genetic