var casper = require('casper').create({
    viewportSize: {
        width: 1024,
        height: 768
    }
});
const x  = require('casper').selectXPath;
const userData = require('./user.json');
casper.options.waitTimeout = 20000;

const taskSelector = '//a[contains(@href,"/' +  casper.cli.args[0] + '")]/../../../../../../..';
const dest = casper.cli.args[1];
const dests = {
    'BL': 'Backlog (Default)',
    'NI': 'Next Iteration',
    'IP': 'In progress',
    'IT': 'Iteration',
    'WR': 'Waiting for review',
    'DN': 'Done'
};

const destSelector =' //h3[.="' + dests[dest] + '"]/../../div[position()=2]/ul'

casper.start('http://phabricator.bitnami.com:8080/project/board/1/query/assigned/', function() {
    this.waitForSelector('div.aphront-form-control-text input').then(function() {
 	this.sendKeys('div.aphront-form-control-text input', userData.user);
 	this.sendKeys('div.aphront-form-control-password input', userData.password);
	this.click('div.grouped button');
    });

    this.waitForSelector('div.aphront-form-control-text input').then(function() {
	this.waitForSelector(x(taskSelector)).then(function() {
	    this.waitForSelector(x(destSelector)).then(function() {
		this.mouse.down(x(taskSelector));
		this.mouse.move(x(destSelector));
	    });
	    this.then(function() {
		this.mouse.up(x(destSelector));
		this.echo('Moved ' +  casper.cli.args[0] + ' to ' + dests[dest]);
		this.capture('./nabete.png');
	    })
	});
    });

    
});

casper.run();
