var fs = require('fast-csv');
var stats = {};
var createCanduit = require('canduit');
var parseArgs = require('minimist');
var sys = require('sys')
var exec = require('child_process').exec;
function puts(error, stdout, stderr) { sys.puts(stdout) }
let timeFrom = '00:00';
var spawn = require('child_process').spawn;
let putEstimates = true;
let putPriority = true;
let putNotes = true;
let putMinutes = true;
let moveTasks = true;
let onlyOneTask = false;
let excludeTask = 'None';
let onlyTask = 'none';
var argv = parseArgs(process.argv, opts={boolean: ['onlytriage', 'onlymove'], string: 'from'});

if (argv.onlytriage) {
    putNotes = false;
    putMinutes = false;
    moveTasks = false;
}

if (argv.onlymove) {
    putNotes = false;
    putEstimates = false;
    putMinutes = false;
    putPriority = false;
}

if (argv.from) {
    timeFrom = argv.from;
}

if (argv.task) {
    onlyOneTask = true;
    onlyTask = argv.task;
    
}

if (argv.exclude) {
    excludeTask = argv.exclude;
}

fs
    .fromPath(process.argv[2])
    .on("data", function(data){
	let task = data[1].match(/T[0-9]+/);
	let estimated = data[1].match(/[0-9]+([.][0-9]+)?h/);
	let status;
	let priority;
	let notes;
	let time = data[5].match(/[0-9]+:[0-9]+/);
	if (timeFrom <= time) {	    
	    if (task) {
		task = task[0];
		if ( (excludeTask === task) || (onlyOneTask && !(onlyTask === task))) {
		    return;
		}
		let seconds = parseInt(data[7]);
		if (stats[task]) {
		    stats[task].seconds += seconds;
		} else {
		    stats[task] = {};
		    stats[task].seconds = seconds;
		}
		if (estimated) {
		    stats[task].estimated = parseInt(estimated[0].replace('h',''));
		}
		if (data[11].match(/#status/)) {
		    status = data[11];
		}
		if (data[11].match(/#priority/)) {
		    priority = data[11].replace('#priority ', '');
		}
		if (data[11].match(/#notes/)) {
		    notes = data[11].replace('#notes', '');
		}
		if (data[11].match(/#move/)) {
		    stats[task].move = data[11].replace('#move ', '');
		}
		if (status) {
		    stats[task].status = status;
		}
		if (notes) {
		    if (stats[task].notes) { 
			stats[task].notes += '\n\n' + `**(${time}):** ` + notes;
		    } else {
			stats[task].notes = `Notes (${data[4].match(/[0-9]+\/[0-9]+\/[0-9]+/)})\n==============\n\n` + `**(${time}):** ` + notes;
		    }
		}
	    }
	}
    })
    .on("end", function(){
	for (let key in stats) {
	    stats[key].seconds = Math.floor(stats[key].seconds / 60);
	}
	console.log(stats);

	createCanduit(function (err, canduit) {
	    let phTasksWithoutLetter = [];
	    
	    for (var phkey in stats) {
		phTasksWithoutLetter.push(phkey.substring(1));
	    }
	    // Execute a conduit API call
	    canduit.exec('maniphest.query', {
		ids: phTasksWithoutLetter 
	    }, function (err, phData) {
		if (err) throw err;
		for (var task in phData) {
		    const taskWithLetter = `T${phData[task].id}`;
		    let idInt = parseInt(phData[task].id);
		    let currentMinutes = phData[task].auxiliary["std:maniphest:mycompany:actual-hours"];
		    let currentEstHours = phData[task].auxiliary["std:maniphest:mycompany:estimated-hours"];
		    let updateTask = false;
		    
		    if (currentMinutes) {
			stats[taskWithLetter].seconds += currentMinutes;
		    }

		    let updateQuery1 = {
			id: idInt,
			auxiliary: {}
		    };

		    if (putEstimates && stats[taskWithLetter].estimated && stats[taskWithLetter].estimated != currentEstHours) {
			updateQuery1.auxiliary["std:maniphest:mycompany:estimated-hours"] = stats[taskWithLetter].estimated;
			updateTask = true;
		    }

		    if (putNotes) {
			if (stats[taskWithLetter].notes) {
			    updateQuery1.comments = stats[taskWithLetter].notes;
			    updateTask = true;
			}
		    }
		    if (putMinutes) {
			updateQuery1.auxiliary["std:maniphest:mycompany:actual-hours"] =  stats[taskWithLetter].seconds;
			updateTask = true;
		    }
		    
		    if (updateTask) { 
			canduit.exec('maniphest.update', updateQuery1, function (err, data) {
			    if (err)  {
				console.log(`Actual minutes for task ${taskWithLetter} Failed`);
			    } else {
				console.log(`Actual minutes for task ${taskWithLetter} done correctly`);
			    }
			    if (stats[taskWithLetter].status) {
				
				let updateQuery2 = {
				    id: idInt,
				    comments: stats[taskWithLetter].status
				};
				
				canduit.exec('maniphest.update', updateQuery2, function (err, data) {
				    if (err)  {
					console.log(`Status for task ${taskWithLetter} Failed`);
				    } else {
					console.log(`Status for task ${taskWithLetter} done correctly`);
				    }				    
				});
			    }
			});
		    }
		    
		    if (moveTasks && stats[taskWithLetter].move) {
			spawn('casperjs', ['movetask.js', taskWithLetter, stats[taskWithLetter].move], {
			    detached: true,
			    stdio: 'inherit'
			});
		    }		 
		}
	    });
	});
    });
