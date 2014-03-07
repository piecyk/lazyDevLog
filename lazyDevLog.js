/**
 * @fileOverview
 * @name lazyDevLog.js
 * @author piecyk
 * @license
 */

var exec = require('child_process').exec,
    _ = require('underscore'),
    request = require('request'),
    moment = require('moment'),
    xml2js = require('xml2js'),
    q = require('q'),
    promptly = require('promptly'),
    readline = require('readline'),
    Table = require('cli-table'),
    util = require('util'),
    
    //TODO rename to config.js
    _config = require('./config.js'),
    _dateInfo = getDateTillToday(),
    COOKIE = null;


function jiraQueryIssues(day) {
    var deferred = q.defer();
    request.get(_config.jira.url + "search?jql=assignee=" +
                encodeURIComponent(_config.jira.user + " and (status was 'in progress' ON '"+day+"' or status changed ON '"+day+"')"), {
                    headers: {
                        'Authorization': 'Basic '+new Buffer(_config.jira.user+':'+_config.jira.pass).toString('base64'),
                        'Content-Type': 'application/json'
                    }        
                }, function (error, response, body) {
                    if (error) throw new Error('ehh wina Tuska...! '+ error);
                    try {
                        deferred.resolve(JSON.parse(body));
                    } catch (e) {
                        deferred.resolve(null);
                    };                   
                });
    return deferred.promise;
};

function logIn(user, pass) {
    console.log('Try to log in, you lazy ....');
    var deferred = q.defer();
    request.post(_config.url.login, {
        'form' : {
            email: (user || _config.user),
            password: (pass || _config.pass),
            remember: 'true'
        }
    }, function (error, response, body) {
        if (error) throw new Error('something wrong...' + error);
        deferred.resolve(COOKIE = response.headers['set-cookie'][0]);
    });
    return deferred.promise;
};

function getDataFromUrl(url, _from, _to, cookie) {
    var deferred = q.defer();
    request.get(url + '?date_from=' + (_from || _dateInfo.from) + '&date_to=' + (_to || _dateInfo.to), {
        headers: { 'Cookie': (cookie || COOKIE) }
    }, function (error, response, body) {
        if (error) throw new Error('mega buuu!' + error);
        deferred.resolve(body);
    });
    return deferred.promise;
};

function addThis(sendObj, cookie) {
    var deferred = q.defer();
    request.post(_config.url.add, {
        headers: { Cookie: (cookie || COOKIE) },
        form : sendObj
    }, function (error, response, body) {
        if (error) throw new Error('ehh wina Tuska...!');
        console.log('just made this for you lazy ass, day: ', sendObj.data);
        deferred.resolve(200);
    });
    return deferred.promise;
};

function deleteThis(id, cookie) {
    var deferred = q.defer();
    request.get(_config.url.delete +'?id='+id, {
        headers: { Cookie: (cookie || COOKIE) }
    }, function (error, response, body) {
        if (error) throw new Error('ehh wina Tuska...!');
        console.log('just remove this id: ', id);
        deferred.resolve(200);
    });
    return deferred.promise;
};

function getDateTillToday() {
    var _format = { date : 'YYYY-MM-DD', week : 'isoweek' },
        _today = moment().format(_format.date),
        _monday = moment(_today).startOf(_format.week),
        _tillToday = new Array();

    for(var i = 0; i < 5; i++) {
        var day = _monday.format(_format.date);
        _tillToday.push(day);

        if (day === _today) break;
        _monday.add('d', 1);
    }
    return  {
        today : _today,
        from : moment(_today).startOf(_format.week).format(_format.date),
        to: moment(_today).startOf(_format.week).add('d', 6).format(_format.date),
        tillToday : _tillToday
    };
};

function parsePlan(data) {
    var deferred = q.defer(),
        parser = new xml2js.Parser();

    parser.parseString(data, function (err, result) {
        if (!result.result.plan) {
            console.log('You dont have any timesheets for this week');
        } else {
            console.log('Your timesheet for this week :');
            var ret = [];
            _.each(result.result.plan[0].item, function(item, i) {
                var obj = {
                    id : item['$'].id,
                    date : item.date[0],
                    client: { id: item.client[0]['$'].id, name: item.client[0]['_'] },
                    project: { id: item.project[0]['$'].id, name: item.project[0]['_'] },
                    user: { id: item.user[0]['$'].id, name: item.user[0]['_']},
                    status: item.status[0],
                    task: item.task[0],
                    hours: item.hours[0],
                    desc: item.description[0]
                };
                console.log(obj);
                ret.push(obj);
            });
        }
        deferred.resolve({timesheet: ret});
    });
    return deferred.promise;
};

function parseHours(data) {
    var deferred = q.defer(),
        parser = new xml2js.Parser();

    parser.parseString(data, function (err, result) {
        if (!result.result.hours) return;
        var hours = result.result.hours[0]['$'];
        console.log('Your hours for this week :', hours);
        deferred.resolve(hours);
    });
    return deferred.promise;
};

function getGitRepos(day) {
    if (!_config.git) return []; 

    var array = [];
    _.each(_config.git.repos, function(repo) {
        array.push(readFromGitRepo(repo, _config.git.user, day));
    });
    return array;
};


logIn().then(function(arr) {
    console.log('Hello cyfron:'+ _config.user);
    var table = new Table();
    table.push(
        ['Today is', _dateInfo.today]
        , ['This week', 'from:' + _dateInfo.from + ' to:' + _dateInfo.to]
        , ['This week days till today', _dateInfo.tillToday + ' ']
    );
    console.log(table.toString());
    q.all([
        getDataFromUrl(_config.url.hours).then(parseHours),
        getDataFromUrl(_config.url.plan).then(parsePlan)
    ]).spread(function (parsedHours, parsedPlan) {
        var _obj = _.extend(parsedPlan, {hours: parsedHours});
        var filledDays = _.pluck(_obj.timesheet, 'date');
        var emptyDays = _.difference(_dateInfo.tillToday, filledDays);
        var sendObj = {
            data: null,
            projekt: null,
            task: null,
            desc: null,
            godziny: null,

            status: 'finished',
            category:'1',
            estimation:'0',
            drange:_dateInfo.from+'|'+_dateInfo.to,
            date_from: _dateInfo.from,
            date_to: _dateInfo.to,
            pageselect:'1'
        };
        console.log('You forgot about:', emptyDays);
        prompterChoose('what do you want to do:',['a', 'e', 'd', 'q']).then(function(action) {
            menuAcion(action, _obj, sendObj, filledDays, emptyDays);
        });               
    });
});

function menuAcion(action, _obj, sendObj, filledDays, emptyDays) {
    switch (action) {
    case "a":
        add(emptyDays, sendObj);
        break;
    case "e":
        edit(_obj, sendObj, filledDays);
        break;
    case "d":
        remove(_obj, filledDays);
        break;
    case "q":
        console.log("Bye:)");
        break;
    }
};

function remove(_obj, filledDays) {
    prompterChoose('select day:', filledDays).then(function(day) {
        var o = _.findWhere(_obj.timesheet, {date: day});
        console.log('Do you want to remove id:', o.id);
        prompterChoose('(y)es/(n)o:', ['y', 'n']).then(function(yn) {
            switch (yn) {
            case "y":
                deleteThis(o.id);
                break;
            case "n":
                console.log("Bye:)");
                break;
            }
        });
    });
};

function yesNoAdd(yn, obj, addFn, deleteFn) {
    switch (yn) {
    case "y":
        addThis(obj);
        break;
    case "n":
        console.log("Bye:)");
        break;
    case "r":
        build(obj);
        break;                        
    }
};

function yesNoEdit(yn, obj, o) {
    switch (yn) {
    case "y":
        deleteThis(o.id).then(function() {
            addThis(obj);
        });
        break;
    case "n":
        console.log("Bye:)");
        break;
    case "r":
        build(obj);
        break;                        
    }
};

function build(sendObj, editObj) {
    buildSendObj(sendObj).then(function(obj) {
        prompterChoose('Send (y)es/(n)o/(r)etry:', ['y', 'n', 'r']).then(function(yn) {
            editObj ? yesNoEdit(yn, obj, editObj) : yesNoAdd(yn, obj);
        });
    });
};

function buildFactory(day, sendObj, editObj) {
    q.all(getGitRepos(day)).then(function(result) {
        console.log('\nGit hub log for this day: ');
        console.log(util.inspect(result, false, null));

        jiraQueryIssues(day).then(function(data) {
            if (data) {;
                console.log('\nYour jira task in progress or status changed for this day:');
                _.each(data.issues, function(i) {                
                    console.log('Parent: '+ i.fields.parent.key + ' ' + i.fields.parent.fields.summary + ' Status: ' + i.fields.status.name);
                    console.log(i.key + ' ' + i.fields.summary);
                });
                console.log(' ');
            }
            build(sendObj, editObj);
        });          
    });
};

function add(emptyDays, sendObj) {
    prompterChoose('select day:', emptyDays).then(function(day) {
        sendObj.data = day;
        buildFactory(day, sendObj);
    });
};

function edit(_obj, sendObj, filledDays) {
    prompterChoose('select day:', filledDays).then(function(day) {
        var o = _.findWhere(_obj.timesheet, {date: day});
        sendObj.data = day;
        sendObj.projekt = o.project.id;
        sendObj.task = o.task;
        sendObj.desc = o.desc;
        sendObj.godziny = o.hours;
        buildFactory(day, sendObj, o);
    });
};

function buildSendObj(sendObj) {
    var deferred = q.defer();
    type('Set project id', (sendObj.projekt || _config.projects[0].id), _config.projects)
        .then(function(projectId) {
            sendObj.projekt = projectId;
            type('Set task', (sendObj.task || _config.defaultTask)).then(function(task) {
                sendObj.task = task;
                type('Set desc', (sendObj.desc ||  _config.defaultDesc)).then(function(desc) {
                    sendObj.desc = desc;
                    type('Set hours', (sendObj.godziny ||  _config.hours)).then(function(hours) {
                        sendObj.godziny = hours;
                        deferred.resolve(sendObj);
                    });
                });
            });
        });
    return deferred.promise;
};

function type(question, valueToEdit, possibleValues) {
    if (possibleValues) console.log('possible values: ', possibleValues);

    var deferred = q.defer();
    var r = readline.createInterface({
        input: process.stdin,
        output: process.stdout});

    r.write(new String(valueToEdit));
    r.question(question + ': ', function(value) {
        r.close();
        deferred.resolve(value);
    });
    return deferred.promise;
}

function prompterChoose(text, array) {
    var deferred = q.defer();
    console.log('Select form: ', array);
    promptly.choose(text, array, function (err, value) {
        deferred.resolve(value);
    });
    return deferred.promise;
};

function readFromGitRepo(repo, author, day) {
    var deferred = q.defer(),
        options = {
            repo: repo.path + repo.id,
            author: author,
            day: day,
            fields: [ 'subject']
        };
    gitlog(options).then(function(commits) {
        deferred.resolve({
            commits : commits,
            repo: repo.id
        });
    });
    return deferred.promise;
}

function gitlog(options) {
    if (!options.repo) throw new Error('Repo required!');

    var deferred = q.defer(),
        delimiter = '\t',
        fields = {
            subject: '%s'
        },
        command = 'cd ' + options.repo + ' && git log --author="' + options.author +
            '" --after="'+options.day+' 00:00" --before="'+options.day+' 23:59" --pretty="';

    options.fields.forEach(function(field) {
        if (!fields[field]) throw new Error('Unknown field: ' + field);
        command += delimiter + fields[field];
    });
    command += '"';

    exec(command, function(err, stdout, stderr) {
        var commits = stdout.split('\n');
        // Remove the last blank element from the array
        commits.pop();
        commits = parseCommits(commits, options.fields, delimiter);

        if(stderr || err) {
            throw new Error('something wrong with git: ' + err);
        } else {
            deferred.resolve(commits);
        }
    });
    return deferred.promise;
};

function parseCommits(commits, fields, delimiter) {
    return commits.map(function(commit) {
        commit = commit.split(delimiter);
        // Remove the first empty char from the array
        commit.shift();
        var parsed = {};
        commit.forEach(function(commitField, index) {
            parsed[fields[index]] = commitField;
        });
        return parsed;
    });
};
