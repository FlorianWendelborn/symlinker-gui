var path = require('nw.gui').App.dataPath;

/*--------------------------------------------------[symlinker]--------------------------------------------------*/

var symlinker; // #todo

/*--------------------------------------------------[nedb]--------------------------------------------------*/

var Datastore = require('nedb')
  , db = {
		links: new Datastore({ filename: path + '/links.nedb' }),
		lists: new Datastore({ filename: path + '/lists.nedb' }),
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
		.when('/links', {
			templateUrl: 'html/links/main.html',
			controller: 'LinksController'
		})
		.when('/lists', {
			templateUrl: 'html/lists/main.html',
			controller: 'ListsController'
		})
		.when('/settings', {
			templateUrl: 'html/settings/main.html',
			controller: 'SettingsController'
		})
		.otherwise({
			redirectTo: '/'
		});
});

app.run(function($rootScope, $location, NeDBService) {
	NeDBService.getSettings($rootScope);
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
	this.updateLink = function (link, callback) {
		db.links.update({_id: link._id}, {
			name: link.name,
			source: link.source,
			destination: link.destination
		}, callback);
	}

	// lists
	this.getLists = function ($scope) {
		db.lists.find({}, function (err, data) {
			if (!err) {
				$scope.$apply(function () {
					$scope.lists = data;
				});
			} else {
				console.error(err);
			}
		});
	}
	this.addList = function (newList, callback) {
		delete(newList._id);
		for (var i = 0; i < newList.files.length; i++) {
			delete(newList.files[i].$$hashKey);
		}
		db.lists.insert(newList, callback);
	}
	this.deleteList = function (id, callback) {
		db.lists.remove({_id: id}, callback);
	}

	// settings
	this.getSettings = function ($scope) {
		db.settings.count({}, function (err, count) {
			if (!count) db.settings.insert({
				type: 'general'
			}, function (err, data) {
				if (!err) {
					console.log('inserted basic settings');
				} else {
					console.error(err);
				}
			});
		});
		db.settings.findOne({type: 'general'}, function (err, data) {
			if (!err) {
				$scope.$apply(function () {
					$scope.settings = data;
				});
			} else {
				console.error(err);
			}
		});
	}
	this.updateSettings = function (settings) {
		db.settings.update({type: 'general'}, settings, function (err, data) {
			if (err) console.error(err);
		})
	}
});

/*--------------------------------------------------[controllers]--------------------------------------------------*/
app.controller('LinksController', function ($scope, $rootScope, $modal, NeDBService) {

	$scope.editLink;
	$scope.newLink;
	$scope.links;

	NeDBService.getLinks($scope);

	$scope.clear = function () {
		$scope.newLink = null;
	}

	$scope.add = function () {
		NeDBService.addLink($scope.newLink, function (err, data) {
			NeDBService.getLinks($scope);
		});
		$scope.newLink = {};
	};

	$scope.run = function (link) {
		console.log('#todo - run query')
	}

	$scope.update = function (link) {
		NeDBService.updateLink($scope.editLink, function (err, data) {
			if (!err) {
				NeDBService.getLinks($scope);
				$scope.editLink = null;
			} else {
				console.error(err);
			}
		});
	}

	$scope.edit = function (link) {
		if (!$scope.editLink || $scope.editLink._id != link._id) { // start edit
			$scope.editLink = link;
		} else { // stop edit
			$scope.editLink = null;
		}
	}

	$scope.delete = function (link) {
		var modalInstance = $modal.open({
			templateUrl: 'html/links/delete.html',
			controller: LinksDeleteModalController,
			resolve: {
				link: function () {
					return link;
				}
			}
		});

		modalInstance.result.then(function () { // ok
			NeDBService.deleteLink(link._id, function (err, data) {
				if (!err) {
					NeDBService.getLinks($scope);
				} else {
					console.error(err);
				}
			});
		}, function () { // cancel

		});
	}

	$scope.dismissInfo = function () {
		$rootScope.settings.linksDismissInformation = true;
		NeDBService.updateSettings($rootScope.settings);
	}
});

var LinksDeleteModalController = function ($scope, $modalInstance, link) {
	$scope.link = link;

	$scope.ok = function () {
		$modalInstance.close();
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
};

// lists

app.controller('ListsController', function ($scope, $rootScope, $modal, NeDBService) {
	
	$scope.newList;

	NeDBService.getLists($scope);

	$scope.add = function () {
		var modalInstance = $modal.open({
			templateUrl: 'html/lists/add.html',
			controller: ListsAddModalController
		});

		modalInstance.result.then(function (list) { // ok
			NeDBService.addList(list, function (err, data) {
				if (!err) {
					NeDBService.getLists($scope);
				} else {
					console.error(err);
				}
			});
		}, function () { // cancel

		});
	}

	$scope.clear = function () {
		$scope.newList = null;
	}

	$scope.run = function (list) {
		// #todo
	}

	$scope.edit = function (list) {
		// #todo
	}

	$scope.delete = function (list) {
		var modalInstance = $modal.open({
			templateUrl: 'html/lists/delete.html',
			controller: ListsDeleteModalController,
			resolve: {
				list: function () {
					return list;
				}
			}
		});

		modalInstance.result.then(function () { // ok
			NeDBService.deleteList(list._id, function (err, data) {
				if (!err) {
					NeDBService.getLists($scope);
				} else {
					console.error(err);
				}
			});
		}, function () { // cancel

		});
	}

	$scope.dismissInfo = function () {
		$rootScope.settings.listsDismissInformation = true;
		NeDBService.updateSettings($rootScope.settings);
	}
});

var ListsAddModalController = function ($scope, $modalInstance) {
	
	$scope.list = {
		files: []
	}

	$scope.newFile = {};

	$scope.ok = function () {
		$modalInstance.close($scope.list);
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};

	$scope.clear = function () {
		$scope.newFile = {};
	}

	$scope.add = function () {
		if ($scope.newFile.name && $scope.newFile.path && $scope.newFile.name != '' && $scope.newFile.path != '') {
			$scope.list.files.push($scope.newFile);
			$scope.newFile = {}
		}
	}
};

var ListsDeleteModalController = function ($scope, $modalInstance, list) {
	$scope.list = list;

	$scope.ok = function () {
		$modalInstance.close();
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
};

// settings

app.controller('SettingsController', function ($scope, $rootScope, NeDBService) {

	$scope.editKey;

	$scope.edit = function (key) {
		if ($scope.editKey != key) {
			$scope.editKey = key;
		} else {
			$scope.editKey = null;
		}
	}

	$scope.delete = function (key) {
		delete ($rootScope.settings[key]);
		NeDBService.updateSettings($rootScope.settings);
	}
});