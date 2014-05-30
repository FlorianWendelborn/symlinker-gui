var gui = require('nw.gui');
var appPath = gui.App.dataPath;
var path = require('path');
var fs = require('fs');

/*--------------------------------------------------[symlinker]--------------------------------------------------*/

var symlinker = require('../symlinker');

/*--------------------------------------------------[nedb]--------------------------------------------------*/

var Datastore = require('nedb')
  , db = {
		links: new Datastore({ filename: appPath + '/links.nedb' }),
		lists: new Datastore({ filename: appPath + '/lists.nedb' }),
		settings: new Datastore({ filename: appPath + '/settings.nedb' })
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

// folder dialog
var folderDialog, folderCallback;

function openFolder (options, callback) {
	if (options.path) {
		folderDialog.setAttribute('nwworkingdir', path.dirname(options.path));
	} else {
		folderDialog.removeAttribute('nwworkingdir');
	}

	folderCallback = callback;
	
	// fix $scope.$apply errors
	setTimeout(function () {
		folderDialog.click();
	},0);
}
// end folder dialog

// file dialog
var fileDialog, fileCallback;

function openFile (options, callback) {
	if (options.path) {
		fileDialog.setAttribute('nwworkingdir', path.dirname(options.path));
	} else {
		fileDialog.removeAttribute('nwworkingdir');
	}
	if (options.accept) {
		fileDialog.setAttribute('accept', options.accept);
	} else {
		fileDialog.removeAttribute('accept');
	}

	fileCallback = callback;

	// fix $scope.$apply errors
	setTimeout(function () {
		fileDialog.click();
	},0);
}
// end file dialog

// fileSave dialog
var fileSaveDialog, fileSaveCallback;

function saveFile (options, callback) {
	if (options.path) {
		fileSaveDialog.setAttribute('nwworkingdir', path.dirname(options.path));
	} else {
		fileSaveDialog.removeAttribute('nwworkingdir');
	}
	if (options.accept) {
		fileSaveDialog.setAttribute('accept', options.accept);
	} else {
		fileSaveDialog.removeAttribute('accept');
	}
	fileSaveDialog.setAttribute('nwsaveas', options.filename);

	fileSaveCallback = callback;

	// fix $scope.$apply errors
	setTimeout(function () {
		fileSaveDialog.click();
	},0);
}
// end fileSave dialog

app.run(function($rootScope, $location, NeDBService) {
	// folder dialog
	folderDialog = document.getElementById('folderDialog');

	folderDialog.addEventListener('change', function (){
		folderCallback(this.value);
	});
	// end folder dialog
	
	// file dialog
	fileDialog = document.getElementById('fileDialog');

	fileDialog.addEventListener('change', function (){
		fileCallback(this.value);
	});
	// end file dialog

	// fileSave dialog
	fileSaveDialog = document.getElementById('saveFileDialog');

	fileSaveDialog.addEventListener('change', function (){
		fileSaveCallback(this.value);
	});
	// end fileSave dialog
	
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

	// variables
	$scope.editLink;
	$scope.newLink = {};
	$scope.links;
	// end variables

	// folder choosing
	$scope.chooseSourceFolder = function () {
		openFolder({
			path: $scope.newLink.source
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.newLink.source = path;
			});
		});
	}

	$scope.chooseSourceFile = function () {
		openFile({
			path: $scope.newLink.source
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.newLink.source = path;
			});
		});
	}

	$scope.showSource = function () {
		gui.Shell.showItemInFolder($scope.newLink.source);
	}

	$scope.chooseDestinationFolder = function () {
		openFolder({
			path: $scope.newLink.destination
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.newLink.destination = path;
			});
		});
	}

	$scope.chooseDestinationFile = function () {
		openFile({
			path: $scope.newLink.destination
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.newLink.destination = path;
			});
		});
	}

	$scope.showDestination = function () {
		gui.Shell.showItemInFolder($scope.newLink.destination);
	}

	$scope.editSourceFolder = function () {
		openFolder({
			path: $scope.newLink.source
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.editLink.source = path;
			});
		});
	}

	$scope.editSourceFile = function () {
		openFile({
			path: $scope.newLink.source
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.editLink.source = path;
			});
		});
	}

	$scope.showEditSource = function () {
		gui.Shell.showItemInFolder($scope.editLink.source);
	}

	$scope.editDestinationFolder = function () {
		openFolder({
			path: $scope.newLink.destination
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.editLink.destination = path;
			});
		});
	}
	$scope.editDestinationFile = function () {
		openFile({
			path: $scope.newLink.destination
		}, function (path) {
			if (path) $scope.$apply(function () {
				$scope.editLink.destination = path;
			});
		});
	}

	$scope.showEditDestination = function () {
		gui.Shell.showItemInFolder($scope.editLink.destination);
	}
	// end folder choosing

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

	// main
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

	$scope.import = function () {
		openFile({
			accept: '.sjlist'
		}, function (path) {
			fs.readFile(path, function (err, data) {
				if (!err) {
					try {
						var json = JSON.parse(data);
						if (json.source || json.destination || json.files) {
							NeDBService.addList(json, function (err, data) {
								if (!err) {
									NeDBService.getLists($scope);
								} else {
									console.error(err);
								}
							});
						} else {
							alert('invalid file');
							console.error('invalid import file');
						}
					} catch (err) {
						console.error(err);
					}
				} else {
					console.error(err);
				}
			});
		});
	}
	$scope.runAll = function () {
		alert('#todo');
	}
	// end main

	// per list
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

	$scope.unlink = function (index) {
		var list = $scope.lists[index];
		symlinker.removeAdvanced(list, {
			ignoreMissingSymbolicLinks: $scope.settings.ignoreMissingSymbolicLinks
		}, function (err, data) {
			if (!err) {
				console.log('successfully unlinked')
			} else {
				console.error(err); // #todo
			}
		});
	}

	$scope.export = function (index) {
		var list = $scope.lists[index];
		// #todo option for default location
		saveFile({
			filename: list.name + '.sjlist',
			accept: '.sjlist'
		}, function (path) {
			fs.writeFile(path, JSON.stringify({
				name: list.name,
				source: list.source,
				destination: list.destination,
				files: list.files
			}), function (err, data) {
				if (!err) {
					console.log('successfully exported file ' + path);
				} else {
					alert('could not export file ' + path);
					console.error(err);
				}
			});
		});
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

	$scope.ok = function () {
		$modalInstance.close($scope.list);
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
