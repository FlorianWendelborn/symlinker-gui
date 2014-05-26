var path = require('nw.gui').App.dataPath;

/*--------------------------------------------------[nedb]--------------------------------------------------*/

var Datastore = require('nedb')
  , db = {
		links: new Datastore({ filename: path + '/links.nedb' }),
		settings: new Datastore({ filename: path + '/settings.nedb' })
	}

for (var i in db) {
	db[i].loadDatabase(function (err) {
		if (err) console.error(err);
	});
}

/*--------------------------------------------------[angular]--------------------------------------------------*/

var app = angular.module('app', ['ngRoute','ui.bootstrap']).config(function ($routeProvider) {
	$routeProvider
		.when('/', {
			templateUrl: 'html/main.html'
		})
		.otherwise({
			redirectTo: '/'
		});
});

app.run(function($rootScope, $location) {
	$rootScope.$on( "$routeChangeStart", function(event, next, current) {
		$rootScope.currentPath = next.$$route.originalPath;
	});
});

app.service('NeDBService', function () {
	// links
	this.getLinks = function ($scope) {
		db.links.find({}, function (err, data) {
			if (!err) {
				$scope.$apply(function () {
					$scope.links = data;
				});
			} else {
				console.error(err);
			}
		});
	}
	this.addLink = function (newItem, callback) {
		db.links.insert(newItem, callback);
	}
	this.deleteLink = function (id, callback) {
		db.links.remove({_id: id}, callback);
	}

	// settings
	this.getSettings = function ($scope) {
		db.settings.find({}, function (err, data) {
			if (!err) {
				$scope.$apply(function () {
					$scope.settings = data;
				});
			} else {
				console.error(err);
			}
		});
	}
});

/*--------------------------------------------------[controllers]--------------------------------------------------*/
app.controller('LinksController', function ($scope, NeDBService) {

	NeDBService.getLinks($scope);

	$scope.clear = function () {
		$scope.newLink = {};
	}

	$scope.add = function () {
		NeDBService.addLink($scope.newLink, function (err, data) {
			NeDBService.getLinks($scope);
		});
		$scope.newLink = {};
	};

	$scope.run = function (id) {
		console.log('#todo - run query')
	}

	$scope.edit = function (id) {

	}

	$scope.delete = function (id) {
		NeDBService.deleteLink(id, function (err, data) {
			if (!err) {
				NeDBService.getLinks($scope);
			} else {
				console.error(err);
			}
		});
	}
});

app.controller('SettingsController', function ($scope, NeDBService) {
	NeDBService.getSettings($scope);
});