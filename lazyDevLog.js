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

    parser = new xml2js.Parser(),
    _dateInfo = getDateTillToday(),
    _config = require('./config.js'),

    COOKIE = null;

//console.log(_config2);

function gitlog(options) {
    if (!options.repo) throw new Error('Repo required!');

    var deferred = q.defer(),
        delimiter = '\t',
        fields = { 
            authorName: '%an'
            , subject: '%s'
        },
        command = 'cd ' + options.repo + ' && git log ';

    if (options.number) {
        command += ' -n' + options.number;
    } 
    if (options.author) {
        command += ' --author="' + options.author + '" ';
    } 
    if (options.day) {
        command += ' --after="'+options.day+' 00:00" --before="'+options.day+' 23:59" ';
    } 
    command += ' --pretty="';
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
}

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
}
        
function getDateTillToday() {
    var _format = { 
        date : 'YYYY-MM-DD', 
        week : 'isoweek'
    },
        today = moment().format(_format.date),
        _monday = moment(today).startOf(_format.week),
        _tillToday = new Array();

    for(var i = 0; i < 5; i++) {
        var day = _monday.format(_format.date);
        _tillToday.push(day);    
        if (day === today) {
            break;
        };
        _monday.add('d', 1);
    }    
    return  {
        today : today,
        from : moment(today).startOf(_format.week).format(_format.date),
        to: moment(today).startOf(_format.week).add('d', 6).format(_format.date),
        tillToday : _tillToday
    };
}

function logIn() {    
    var deferred = q.defer();
    request.post(_config.url.login, { 
        'form' : {
            email: _config.user,
            password: _config.pass,
            remember: 'true'
        }
    }, function (error, response, body) {
        if (!error) {
            console.log('Good we are log in, you lazy ....');
            COOKIE = response.headers['set-cookie'][0];
            deferred.resolve(COOKIE);
        } else {
            throw new Error('something wrong...');
        }
    });
    return deferred.promise;
};

function getYourReports(cookie, _from, _to) {

    _from = _from || _dateInfo.from;
    _to = _to || _dateInfo.to;

    var deferred = q.defer();
    request.get(_config.url.reports+'?date_from='+_from+'&date_to='+_to, {        
        headers: {
            'Cookie': cookie
        }
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            try {
                parser.parseString(body, function (err, parsed) {
                    var _array = [], diff;
                    _.each(parsed.result.plan[0].item, function(item) {
                        _array.push(item.date[0]);
                    });
                    diff = _.difference(_dateInfo.tillToday, _array);
                    if (diff.length>0) {
                        console.log('Damn, you forgot to log on this days: ', diff);
                        deferred.resolve(diff);
                    } else {
                        console.log('There is nothing to do, go and have a cup of coffee... idz masakrowac lewaków...');
                    }
                });
            } catch (ex) {
                throw new Error('Something wrong with your username or pass!');
            }
        } else {
            throw new Error('mega buuu!');
        }
    });
    return deferred.promise;
}

function logThis(cookie, day, task, project, hour, from, to, desc, status) {
    status = status || 'finished';

    var deferred = q.defer();
    request.post(_config.url.logTo, {        
        headers: {
            'Cookie': cookie
        },
        'form' : {
            'data': day,
            'task' : task,
            'projekt':project,
            'date_from': from,
            'date_to':to,
            'godziny':hour,
            'desc' : desc,
            'status': status,
            'category': '1',
            'pageselect':'1'
        }
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log('just made this for you lazy ass, day: ', day);
            deferred.resolve(200);
        } else {
            throw new Error('ehh ty lewacka...!');
        };
    });
    return deferred.promise;
}

function readFromGitRepo(repo, author, day) {   
    var deferred = q.defer(),
        options = { 
            repo: repo.path, 
            author: author,
            day: day,
            fields: [ 'subject']
        };    
    
    gitlog(options).then(function(commits) {
        var msg = '';
        _.each(commits, function(commit) {
            msg += commit.subject + ', ';           
        });
        
        deferred.resolve({
            msg : msg,
            day: day,
            repo: repo.id
        });
    });     
    return deferred.promise;
}

function go(arrayToLog) {    
    var ps = [];
    for (var i=0, l=arrayToLog.length; i<l; i++) {
        ps[i] = getFromDay(arrayToLog[i]);   
    }
    return q.all(ps);
}

// smutny korwin ;( jak to zobaczy
function getFromDay(day) {
    var deferred = q.defer();
    _.each(_config.projects, function(project) {
        var ret = [];
        if (project.hours && project.hours > 0) {
            if (project.repos) {
                _.each(project.repos, function(repo) {                
                    readFromGitRepo(repo, _config.gitUser, day).then(function(fromGit) {                                                
                        ret.push(_.extend(fromGit, {projectId: project.id}));
                        if(ret.length === project.repos.length) {
                            deferred.resolve(ret);
                        }
                    });
                });
            } else {
                //TODO: report if now repo to check
                console.log(' dont supported yet for day:', day);
            }
        } else {
            console.log(' you cannot raport on project:'+ project.id+' without hours for day:', day);
        }
    }); 
    return deferred.promise;
}


logIn().then(getYourReports).then(go).then(function(obj) {

    _.each(obj,function(dayList) {
        // if you have more than one project
        _.each(_config.projects, function(project) {

            // TODO: refactor this,,, 

            var tmpOneProject = _.where(dayList, {projectId: project.id}),
                endMsg = '',
                endRepos = '',
                day = '',
                desc = '';

            _.each(tmpOneProject, function(el) {
                day = el.day;
                if(el.msg !== ' ') {
                    endMsg += el.msg;
                }
                endRepos += el.repo + ' ';
            });
           
            if (_config.checkBeforSend) {
                //TODO: check this 
            } else if(endMsg === '') {
                // random
                endMsg = endRepos + _config.randomMsg;
            };            
            if(_config.addDescription) {
                //TODO: add descripton
            }

            console.log('for project:' + project.id + ', at day:'+ day + ', working repos:'  + endRepos + ', end msg:'  + _config.startOfMsg+endMsg);
            logThis(COOKIE, day, _config.startOfMsg+endMsg, project.id, project.hours, _dateInfo.from, _dateInfo.to, desc);

        });
    });

});
