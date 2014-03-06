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

    //TODO rename to config.js
    _config = require('./config.js'),
    _dateInfo = getDateTillToday(),
    COOKIE = null;



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
        if (error && response.statusCode !== 200) throw new Error('something wrong...' + error);
        deferred.resolve(COOKIE = response.headers['set-cookie'][0]);
    });
    return deferred.promise;
};

function getDataFromUrl(url, _from, _to, cookie) {
    var deferred = q.defer();
    request.get(url + '?date_from=' + (_from || _dateInfo.from) + '&date_to=' + (_to || _dateInfo.to), {
        headers: { 'Cookie': (cookie || COOKIE) }
    }, function (error, response, body) {
        if (error && response.statusCode !== 200) throw new Error('mega buuu!' + error);
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
        if (error && response.statusCode !== 200) throw new Error('ehh wina Tuska...!');
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
        if (error && response.statusCode !== 200) throw new Error('ehh wina Tuska...!');
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
                    client: {
                        id: item.client[0]['$'].id,
                        name: item.client[0]['_']
                    },
                    project: {
                        id: item.project[0]['$'].id,
                        name: item.project[0]['_']
                    },
                    user: {
                        id: item.user[0]['$'].id,
                        name: item.user[0]['_']
                    },
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


        //TODO: refactor

        // a - add
        // e - edit
        // d - delete
        // q - quit
        prompterChoose('what do you want to do:',['a', 'e', 'd', 'q']).then(function(ret) {
            if (ret === 'a') {
                prompterChoose('select day:', emptyDays).then(function(day) {

                    var build = function(sendObj) {
                        buildSendObj(day, sendObj).then(function(obj) {
                            prompterChoose('Send (y)es/(n)o/(r)etry:', ['y', 'n', 'r']).then(function(yn) {
                                if (yn === 'y') {
                                    addThis(obj);
                                } else if (yn === 'r') {
                                    build(obj);
                                } else if (yn === 'n') {
                                    console.log('Bye!');
                                }
                            });
                        });
                    };

                    // TODO: loop over the git repos
                    readFromGitRepo(_config.git.repos[0], _config.git.user, '2014-03-04').then(function(fromGit) {
                        console.log(fromGit);
                        build(sendObj);
                    });
                });
            } else if (ret === 'e') {
                prompterChoose('select day:', filledDays).then(function(day) {
                    var o = _.findWhere(_obj.timesheet, {date: day});
                    sendObj.data = day;
                    sendObj.projekt = o.project.id;
                    sendObj.task = o.task;
                    sendObj.desc = o.desc;
                    sendObj.godziny = o.hours;

                    var build = function(sendObj) {
                        buildSendObj(day, sendObj).then(function(obj) {
                            prompterChoose('Update (y)es/(n)o/(r)etry:', ['y', 'n', 'r']).then(function(yn) {
                                if (yn === 'y') {
                                    // because ///
                                    deleteThis(o.id).then(function() {
                                        addThis(obj);
                                    });
                                } else if (yn === 'r') {
                                    build(obj);
                                } else if (yn === 'n') {
                                    console.log('Bye!');
                                }
                            });
                        });
                    };
                    build(sendObj);
                });
            } else if (ret === 'd') {
                prompterChoose('select day:', filledDays).then(function(day) {
                    var o = _.findWhere(_obj.timesheet, {date: day});
                    console.log('Do you want to remove id:', o.id);
                    prompterChoose('(y)es/(n)o:', ['y', 'n']).then(function(yn) {
                        if (yn === 'y') {
                            deleteThis(o.id);
                        }
                    });
                });
            } else if (ret === 'q') {
                console.log('Bye!');
            }
        });

    });
});

function buildSendObj(day, sendObj) {
    var deferred = q.defer();
    sendObj.data = day;
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
        command = 'cd ' + options.repo + ' && git log --author="' + options.author + '" --after="'+options.day+' 00:00" --before="'+options.day+' 23:59" --pretty="';

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
