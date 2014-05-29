var path = require('nw.gui').App.dataPath;

/*--------------------------------------------------[symlinker]--------------------------------------------------*/

var symlinker = require('../symlinker');

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
	db.settings.count({}, function (err, count) {
		if (!count) {
			db.settings.insert({
				type: 'general',
				recreateSymbolicLinks: true,
				ignoreMissingSymbolicLinks: true
			}, function (err, data) {
				if (!err) {
					console.log('inserted basic settings');
					NeDBService.getSettings($rootScope);
				} else {
					console.error(err);
				}
			});
		} else {
			NeDBService.getSettings($rootScope);
		}
	});
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
	this.updateList = function (list, callback) {
		db.lists.update({_id: list._id}, {
			name: list.name,
			source: list.source,
			destination: list.destination,
			files: list.files
		}, callback);
	}

	// settings
	this.getSettings = function ($scope) {
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
		symlinker.basic(link.source, link.destination, {
			recreateSymbolicLinks: $scope.settings.recreateSymbolicLinks
		}, function (err, successful) {
			if (err) {
				console.error(err);
			} else {
				$scope.result = {
					type: 'success',
					message: 'successfully created symbolic link'
				}
				console.log('successfully created symbolic link');
			}
		});
	}

	$scope.update = function () {
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

		modalInstance.result.then(function (action) { // ok
			switch (action) {
				case 'unlink':
					symlinker.removeBasic(link.destination, function (err, data) {
						if (!err) {

						} else {
							console.error(err); // #todo
						}
					});
				break;
				case 'both':
					symlinker.removeBasic(link.destination, function (err, data) {
						console.log(err, data); // #todo
					});
					NeDBService.deleteLink(link._id, function (err, data) {
						if (!err) {
							NeDBService.getLinks($scope);
						} else {
							console.error(err); // #todo
						}
					});
				break;
				case 'remove':
					NeDBService.deleteLink(link._id, function (err, data) {
						if (!err) {
							NeDBService.getLinks($scope);
						} else {
							console.error(err); // #todo
						}
					});
				break;
				default: console.error('LinksController: unknown modal action: ' + action);
			}
		}, function () { // cancel

		});
	}

	$scope.closeResult = function () {
		delete($scope.result);
	}

	$scope.dismissInfo = function () {
		$rootScope.settings.linksDismissInformation = true;
		NeDBService.updateSettings($rootScope.settings);
	}
});

var LinksDeleteModalController = function ($scope, $modalInstance, link) {
	$scope.link = link;

	$scope.ok = function (action) {
		$modalInstance.close(action);
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};
};

// lists

app.controller('ListsController', function ($scope, $rootScope, $modal, NeDBService) {
	
	$scope.newList;

	$scope.newFile = {};

	$scope.editList;
	$scope.editingFile;

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

	$scope.run = function (index) {
		var list = $scope.lists[index];

		symlinker.advanced(list, {
			recreateSymbolicLinks: $scope.settings.recreateSymbolicLinks
		}, function (err, data) {
			console.log(err, data);
		});
	}

	$scope.edit = function (index) {
		var list = $scope.lists[index];

		if (!$scope.editList || $scope.editList._id != list._id) { // start edit
			$scope.editList = list;
		} else { // stop edit
			NeDBService.getLists($scope);
			$scope.editList = null;
			$scope.editedFile = null;
		}
	}

	$scope.editFile = function (index) {
		var file = $scope.editList.files[index];

		if (!file.editing) { // start edit
			$scope.editedFile = file;
			$scope.editList.files[index].editing = true;
		} else { // stop edit
			$scope.editedFile = null;
			$scope.editList.files[index].editing = false;
		}
	}

	$scope.updateFile = function (index) {
		if ($scope.editedFile.editing) {
			$scope.editedFile.editing = null;
		}
		$scope.editList.files[index] = $scope.editedFile;
		$scope.editedFile = null;
	}

	$scope.deleteFile = function (index) {
		$scope.editList.files.splice(index, 1);
	}

	$scope.editClearFile = function () {
		$scope.newFile = {}
	}

	$scope.editAddFile = function () {
		if (($scope.newFile.name && $scope.newFile.name != '') || ($scope.newFile.path && $scope.newFile.path != '')) {
			$scope.editList.files.push($scope.newFile);
			$scope.newFile = {}
		}
	}

	$scope.update = function () {
		var list = $scope.editList;
		for (var i = 0; i < list.files.length; i++) {
			delete(list.files[i].$$hashKey);
		}
		NeDBService.updateList(list, function (err, data) {
			if (!err) {
				NeDBService.getLists($scope);
				// #todo - prevent accordion reset
				$scope.editList = null;
			} else {
				console.error(err);
			}
		});
	}

	$scope.delete = function (index) {
		var list = $scope.lists[index];

		var modalInstance = $modal.open({
			templateUrl: 'html/lists/delete.html',
			controller: ListsDeleteModalController,
			resolve: {
				list: function () {
					return list;
				}
			}
		});

		modalInstance.result.then(function (action) { // ok
			switch (action) {
				case 'unlink':
					symlinker.removeAdvanced(list, {
						ignoreMissingSymbolicLinks: $scope.settings.ignoreMissingSymbolicLinks
					}, function (err, data) {
						if (!err) {
							console.log('successfully unlinked')
						} else {
							console.error(err); // #todo
						}
					});
				break;
				case 'both':
					symlinker.removeAdvanced(list, {
						ignoreMissingSymbolicLinks: $scope.settings.ignoreMissingSymbolicLinks
					}, function (err, data) {
						if (!err) {
							console.log('successfully unlinked')
						} else {
							console.error(err); // #todo
						}
					});
					NeDBService.deleteList(list._id, function (err, data) {
						if (!err) {
							NeDBService.getLists($scope);
						} else {
							console.error(err); // #todo
						}
					});
				break;
				case 'remove':
					NeDBService.deleteList(list._id, function (err, data) {
						if (!err) {
							NeDBService.getLists($scope);
						} else {
							console.error(err); // #todo
						}
					});
				break;
				default: console.error('LinksController: unknown modal action: ' + action);
			}
		}, function () { // cancel

		});
	}

	$scope.dismissInfo = function () {
		$rootScope.settings.listsDismissInformation = true;
		NeDBService.updateSettings($rootScope.settings);
	}
});

var ListsAddModalController = function ($scope, $modalInstance) {
	
	$scope.editing;

	$scope.list = {
		files: []
	}

	$scope.newFile = {};

	$scope.ok = function (action) {
		$modalInstance.close(action);
	};

	$scope.cancel = function () {
		$modalInstance.dismiss('cancel');
	};

	$scope.clear = function () {
		$scope.newFile = {};
	}

	$scope.edit = function (index) {
		// #todo
	}

	$scope.delete = function (index) {
		$scope.list.files.splice(index, 1);
	}

	$scope.add = function () {
		if (($scope.newFile.name && $scope.newFile.name != '') || ($scope.newFile.path && $scope.newFile.path != '')) {
			$scope.list.files.push($scope.newFile);
			$scope.newFile = {}
		}
	}
};

var ListsDeleteModalController = function ($scope, $modalInstance, list) {
	$scope.list = list;

	$scope.ok = function (action) {
		$modalInstance.close(action);
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

	$scope.dismissInfo = function () {
		$rootScope.settings.settingsDismissInformation = true;
		NeDBService.updateSettings($rootScope.settings);
	}
});