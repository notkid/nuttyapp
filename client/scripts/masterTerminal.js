/*
 * Copyright (c) 2014 krishna.srinivas@gmail.com All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

angular.module('nuttyapp')
    .directive('masterTerminal', function() {
        return {
            templateUrl: "templates/masterTerminal.html",
            scope: true,
            restrict: 'E',
            link: function(scope, element, attrs, termController) {
                var term;
                var termElem;
                var terminalIframeElem;

                termElem = scope.terminalElem;
                terminalIframeElem = scope.terminalIframeElem;
                scope.style = {
                    height: "100%",
                    width: "100%",
                    position: "absolute"
                };

                scope.termstyle = {
                    height: "100%",
                    width: "100%",
                    position: "relative"
                };

                function Nuttyterm(argv) {
                    this.argv_ = argv;
                    this.io = null;
                    this.pid_ = -1;
                }

                Nuttyterm.prototype.run = function() {
                    this.io = this.argv_.io.push();

                    this.io.onVTKeystroke = this.sendString_.bind(this);
                    this.io.sendString = this.sendString_.bind(this);
                    this.io.onTerminalResize = this.onTerminalResize.bind(this);
                }

                Nuttyterm.prototype.sendString_ = function(str) {
                    termController.tossh({
                        data: str
                    });
                };

                Nuttyterm.prototype.onTerminalResize = function(col, row) {
                    scope.rowcol.row = row;
                    scope.rowcol.col = col;
                    scope.$digest();
                };

                termController.fromssh(function(msg) {
                    if (term && msg.data) {
                        term.io.writeUTF8(msg.data);
                    }
                    if (term && msg.paste) {
                        termController.tossh({
                            data: msg.paste
                        });
                    }
                });

                lib.init(function() {
                    term = scope.term = new hterm.Terminal();
                    window.term = scope.term = term;
                    // term.decorate(terminalElem.get(0), terminalIframeElem.get(0));
                    term.decorate(termElem.get(0), terminalIframeElem.get(0));

                    term.windowTitle = function(title) {
                    }

                    term.nuttyPaste = function() {
                        termController.tossh({
                            paste: true
                        });
                    }

                    // term.focuscbk = function() {
                    //     term.focus();
                    // }

                    term.setCursorPosition(0, 0);
                    term.setCursorVisible(true);
                    // term.vt.setDECMode('1000', true);
                    term.runCommandClass(Nuttyterm, document.location.hash.substr(1));
                    termController.setmaster();
                    // start processing the ssh input
                    input();
                });
            },
            controller: ['$scope', 'ssh', 'MasterConnection', 'NuttySession', 'Recorder', 'sshext', '$location',
                function($scope, ssh, MasterConnection, NuttySession, Recorder, sshext, $location) {
                    var ctrl = this;
                    var nuttyio = $location.host() === 'nutty.io' || $location.host() === 'www.nutty.io';
                    $scope.rowcol = {};
                    this.fromssh = function(cbk) {
                        if (nuttyio) {
                            ssh.ondata(function(msg) {
                                cbk(msg);
                                MasterConnection.pipe.write(msg);
                                Recorder.write(msg);
                            });
                        } else {
                            sshext.ondata(function(msg) {
                                cbk(msg);
                                MasterConnection.pipe.write(msg);
                                Recorder.write(msg);
                            });
                        }
                    }
                    this.tossh = function(msg) {
                        if (nuttyio)
                            ssh.write(msg);
                        else
                            sshext.write(msg);
                    }
                    this.changerowcol = function(msg) {
                        NuttySession.setrowcol({
                            row: msg.row,
                            col: msg.col,
                        });
                        msg.rowcol = 1;
                        if (nuttyio)
                            ssh.write(msg);
                        else
                            sshext.write(msg);
                        Recorder.write(msg);
                    }
                    this.setmaster = function() {
                        var clientid;
                        clientid = Session.get("clientid");
                        if (!clientid) {
                            clientid = Random.id();
                            Session.set("clientid", clientid);
                        }
                        if (sessionid = Session.get("sessionid")) {
                            NuttySession.setmaster(sessionid, clientid);
                        } else {
                            Meteor.call('createMasterSession', clientid, function(err, sessionid) {
                                if (!err) {
                                    Session.set("sessionid", sessionid);
                                    NuttySession.setmaster(sessionid, clientid);
                                }
                            });
                        }
                    }
                    MasterConnection.pipe.ondata(function(msg) {
                        if (msg.gettermshot) {
                            console.log("got gettermshot");
                            var termshot = term.document_.body.firstChild.firstChild.innerHTML;
                            MasterConnection.pipe.write({
                                settermshot: termshot
                            });
                            MasterConnection.pipe.write({
                                setcursorposition: {
                                    row: term.getCursorRow(),
                                    col: term.getCursorColumn()
                                }
                            })
                            return;
                        }
                        if (nuttyio)
                            ssh.write(msg);
                        else
                            sshext.write(msg);
                    });
                    $scope.$watch('rowcol', function(newval, oldval) {
                        if (newval && NuttySession.sessionid) {
                            ctrl.changerowcol({
                                row: $scope.term.screenSize.height,
                                col: $scope.term.screenSize.width,
                            });
                        }
                    }, true);
                    $scope.$watch(function() {
                        return NuttySession.sessionid;
                    }, function(newval, oldval) {
                        if (newval && $scope.term) {
                            ctrl.changerowcol({
                                row: $scope.term.screenSize.height,
                                col: $scope.term.screenSize.width,
                            });
                        }
                    });
                }
            ]
        }
    });


angular.module('nuttyapp')
    .directive('nuttyTerminal', function() {
        return function(scope, element) {
            scope.terminalElem = $(element);
        }
    });

angular.module('nuttyapp')
    .directive('nuttyIframe', function() {
        return function(scope, element) {
            scope.terminalIframeElem = $(element);
        }
    });
