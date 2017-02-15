// ==UserScript==
// @name         YT ratio
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Stores visited video likes / dislikes ratios and creates browsable rankings.
// @author       Flagoul
// @match        https://www.youtube.com/*
// @grant        GM_addStyle

// ==/UserScript==

(function() {
    'use strict';

    const LS_KEY = "us-yt-ratio";
    const RANKING_LOWEST_VIEW_COUNT = 100; // the smallest view count possible for a video to be the first ranking
    const RANKING_STEP = 10; // the step (as a factor) between each ranking
    const RANKING_MAX_VIDEOS = 10; // the step (as a factor) between each ranking

    GM_addStyle(`
        #ratio-button {
            width: inherit !important;
        }

        #ratio-button:before {
            margin-right: 4px !important;
            opacity: 1 !important;
            margin-bottom: 3px !important;
        }

        #rankings-container {
            overflow-x: hidden;
            overflow-y: scroll;
            height: 500px;
        }

        #rankings-container h1 {
            margin-left: 15px;
        }

        #rankings-container h2 {
            border-top: 1px solid #e2e2e2;
            margin: 7px 15px 0px;
            padding: 7px 15px 5px;
        }

        #rankings-container .headers {
            margin-left: 15px;
            font-weight: 500;
        }

        #rankings-container .headers span {
            display: inline-block;
            margin-right: 10px;
        }

        #rankings-container .header-position {
            width: 20px;
            text-align: right;
        }

        #rankings-container .header-ratio {
            width: 40px;
            text-align: center;
        }

        #rankings-container ul {
            margin-top: 3px;
        }

        #rankings-container ul span {
            margin-right: 10px;
            display: inline-block;
            text-align: right;
        }

        #rankings-container .list-position {
            width: 20px;
        }

        #rankings-container .list-ratio {
            width: 40px;
        }
    `);

    /**
    * Retrieves the document-related coordinates (top and left) of an element.
    *
    * @param {Object} e - The element whose coordinates are wanted.
    * @return {Object} The coordinates of the element, relative to the top and left of the document. The object has the "top" and "left" attributes.
    */
    function getCoords(e) {
        let box = e.getBoundingClientRect();

        let body = document.body;
        let de = document.documentElement;

        let scrollTop = window.pageYOffset || de.scrollTop || body.scrollTop;
        let scrollLeft = window.pageXOffset || de.scrollLeft || body.scrollLeft;

        let clientTop = de.clientTop || body.clientTop || 0;
        let clientLeft = de.clientLeft || body.clientLeft || 0;

        return {
            "top": Math.round(box.top +  scrollTop - clientTop),
            "left": Math.round(box.left + scrollLeft - clientLeft)
        };
    }

    /**
    * Retrieves values related to current video and stores them in an object, that contains:
    * - id: the video id
    * - title: the video title
    * - view count: how many views the video has
    * - likes: the number of likes on the video
    * - dislikes: the number of dislikes on the video
    * - ratio: the raio of likes / dislikes of the video
    *
    * @return {Object} An object as described above. null if the video contains no likes / dislikes.
    */
    function retrieveValues() {
        let buttons = document.querySelectorAll(".like-button-renderer > span button");

        // deleted video / not on a video
        if (buttons.length === 0) {
            return null;
        }

        let likesButton = buttons[0].classList.contains("hid") ? buttons[1] : buttons[0];
        let dislikesButton = buttons[2].classList.contains("hid") ? buttons[3] : buttons[2];

        let likes = parseInt(likesButton.textContent.replace(/[\s,.]+/g, ""));
        let dislikes = parseInt(dislikesButton.textContent.replace(/[\s,.]+/g, ""));

        // no likes / dislikes displayed
        if (isNaN(likes) || isNaN(dislikes) === 0) {
            return null;
        }

        let id = document.location.href.match(".*?v=([A-Za-z0-9_\-]{11})")[1];
        let title = document.querySelector("#eow-title").title;

        let viewCount = parseInt(document.querySelector(".watch-view-count").textContent.split(/[\s,.]+/).slice(0, -1).join(""));

        // invalid view count
        if (isNaN(viewCount)) {
            return null;
        }

        return {
            "id": id,
            "title": title,
            "viewCount": viewCount,
            "likes": likes,
            "dislikes": dislikes,
            "ratio": dislikes !== 0 ? likes/dislikes : likes
        };
    }

    /**
    * Saves the values of the current video in the local storage and computes the ranking of the videos.
    *
    * Fetches the records in the local storage, adds the current video to it, computes rankings and then saves the records. During the computing, if a ranking has too many
    * videos, removes videos that are the bottom of this ranking. The videos removed will not be saved in the local storage (it includes current video if it would be too low
    * in the ranking).
    *
    * @param {Object} values - The values retrieved from the current video.
    * @param {Number} maxPerRanking - The maximum number of videos per ranking.
    * @return {Object} The computed rankings. @see {@link computeRankings} for the format of the rankings.
    */
    function saveValuesAndComputeRankings(values, maxPerRanking) {
        let records = JSON.parse(localStorage.getItem(LS_KEY));
        if (records === null) {
            records = {};
        }

        delete records[values.id];
        records[values.id] = values;

        let rankings = computeRankings(records, RANKING_LOWEST_VIEW_COUNT, RANKING_STEP);

        for (let i = 0; i < rankings.length; ++i) {

            // if the ranking is too big, truncate it and delete all low-ranked videos records
            let ranking = rankings[i];
            if (ranking.values.length > maxPerRanking) {
                let toDelete = ranking.values.slice(maxPerRanking);
                for (let j = 0; j < toDelete.length; ++j) {
                    delete records[toDelete[j].id];
                }
                rankings[i].values = ranking.values.slice(0, maxPerRanking);
            }
        }

        localStorage.setItem(LS_KEY, JSON.stringify(records));

        return rankings;
    }

    /**
    * Computes the rankings based on values stored. In a ranking, the videos are sorted by ratio (bigger first). A ranking
    * regroups all the video records whose view count is in a given range (for exaple between 10000 and 100000 views).
    *
    * The rankings are generated using two values: from how many views to begin building rankings and the step (as a factor) between rankings.
    * For example, if the "from" value is set to 100 and step to 10, the rankings will be the following: ranking for 100-1000 views,
    * 1000-10000 views, 10000-100000 views and so on. If we use a step of 100 instead, the ranking will be 100-10000, 10000-1000000 and so on.
    * The rankings are generated according to the view count of a given video. If a video would belong to a ranking that doesn't exist, it is created.
    *
    * The generated rankings is a list of ranking, each being an object having the following fields:
    * - lower, the lowest view count a video can have to be in the ranking (inclusive bound),
    * - upper, the biggest view count a video can have to be in the ranking (exclusive bound),
    * - values, the video records sorted by ratio.
    *
    * @param {Object} records - The records from which the rankings will be built.
    * @param {Number} from - From where to strat building rankings. Videos having view count below that point will not be considered.
    * @param {Number} step - The step between rankings (as a factor of multiplication).
    * @return {Object} The computed rankings.
    */
    function computeRankings(records, from, step) {
        if (from <= 0) {
            throw "Smallest view count in rankings can't be <= 0.";
        }

        if (step <= 0) {
            throw "Step between rankings can't be <= 0.";
        }

        let rankings = [];

        for (let key in records) {
            if (records.hasOwnProperty(key)) {
                let record = records[key];

                if (record.viewCount >= from) {

                    let rankingFound = false;
                    let lower = from;
                    let upper = from;

                    for (let rankingNumber = 0; !rankingFound; ++rankingNumber) {
                        lower = upper;
                        upper = lower * step;

                        if (rankingNumber >= rankings.length) {
                            rankings.push({
                                "lower": lower,
                                "upper": upper,
                                "values": []
                            });
                        }

                        if (record.viewCount >= lower && record.viewCount < upper) {
                            rankings[rankingNumber].values.push(record);
                            rankingFound = true;
                        }
                    }
                }
            }
        }

        for (let i = 0; i < rankings.length; ++i) {
            rankings[i].values.sort(function (a, b) {
                return b.ratio - a.ratio;
            });
        }

        return rankings;
    }

    /**
    * Displays the ratio of likes / dislikes of the video. Adds an icon that allows displaying rankings on click.
    *
    * @param {Number} ratio - The ratio of likes / dislikes.
    * @param {Object} rankings - The rankings computed (@see {@link computeRankings}).
    */
    function displayRatio(ratio, rankings) {
        let ratioButton = document.querySelector("#ratio-button");

        if (ratioButton !== null) {
            ratioButton.remove();
        }

        ratioButton = document.createElement("button");
        ratioButton.id = "ratio-button";
        ratioButton.classList.add("yt-uix-button", "yt-uix-button-opacity", "yt-ui-menu-item", "has-icon", "action-panel-trigger-stats");

        let ratioValue = document.createElement("span");
        ratioValue.id = "ratio-value";
        ratioValue.classList.add("yt-uix-button-content");
        ratioValue.appendChild(document.createTextNode(ratio.toFixed(2)));
        ratioButton.appendChild(ratioValue);

        let ratioSpan = document.createElement("span");
        ratioSpan.appendChild(ratioButton);
        ratioSpan.setAttribute("title", "Ratio likes / dislikes");

        document.querySelector(".like-button-renderer").appendChild(ratioSpan);

        ratioButton.onclick = function(e) {
            let rankingsContainer = document.querySelector("#rankings-container");
            if (rankingsContainer === null) {
                displayRankings(rankings, ratioButton);
            } else {
                rankingsContainer.remove();
            }
        };
    }

    /**
    * Displays the rankings generated on button click.
    *
    * @param {Object} rankings - The rankings to display.
    * @param {Object} button - The button that will open the ranking display.
    */
    function displayRankings(rankings, button) {
        let availableRect = document.querySelector("#watch-headline-title").getBoundingClientRect();
        let width = availableRect.right - availableRect.left;

        let coords = getCoords(button);
        let rect = button.getBoundingClientRect();
        let buttonWidth = rect.right - rect.left;

        let rankingsContainer = document.createElement("div");
        rankingsContainer.id = "rankings-container";
        rankingsContainer.classList.add("yt-uix-menu-content", "yt-ui-menu-content", "yt-uix-kbd-nav");
        rankingsContainer.style.width = width + "px";
        rankingsContainer.style.left = (coords.left + buttonWidth - width) + "px";
        rankingsContainer.style.top = (coords.top + 30) + "px";

        let title = document.createElement("h1");
        title.append(document.createTextNode("Rankings of likes / dislikes ratios grouped by view count"));

        rankingsContainer.append(title);

        for (let i = 0; i < rankings.length; ++i) {
          buildList(rankingsContainer, rankings[i]);
        }

        // remove rankings if click outside
        document.addEventListener("click", function(e) {
            if (!rankingsContainer.contains(e.target) && !button.contains(e.target)) {
                rankingsContainer.remove();
            }
        });

        document.querySelector("body").append(rankingsContainer);
    }

    /**
    * Builds the element for a ranking: its title, headers, the videos with their position and ratio.
    *
    * @param {Object} container - The element that will contain the element built.
    * @param {Object} ranking - The ranking and its entries that will be used for the display.
    */
    function buildList(container, ranking) {
        let title = document.createElement("h2");
        title.appendChild(document.createTextNode(ranking.lower.toLocaleString() + " - " + ranking.upper.toLocaleString() + " views"));
        container.append(title);

        let headers = document.createElement("span");
        headers.classList.add("headers");

        let posHeader = document.createElement("span");
        posHeader.classList.add("header-position");
        posHeader.append(document.createTextNode("#"));
        headers.append(posHeader);

        let ratioHeader = document.createElement("span");
        ratioHeader.classList.add("header-ratio");
        ratioHeader.append(document.createTextNode("ratio"));
        headers.append(ratioHeader);

        let titleHeader = document.createElement("span");
        titleHeader.append(document.createTextNode("title"));
        headers.append(titleHeader);

        container.append(headers);

        let ul = document.createElement("ul");
        ul.classList.add("yt-uix-kbd-nav", "yt-uix-kbd-nav-list");

        for (let i = 0; i < ranking.values.length; ++i) {
            let values = ranking.values[i];

            let li = document.createElement("li");
            let a = document.createElement("a");
            a.href = "https://www.youtube.com/watch?v=" + values.id;
            a.classList.add("yt-ui-menu-item");

            let place = document.createElement("span");
            place.classList.add("list-position");
            place.appendChild(document.createTextNode(i + 1));
            a.append(place);

            let ratio = document.createElement("span");
            ratio.classList.add("list-ratio");
            ratio.appendChild(document.createTextNode(values.ratio.toFixed(2)));
            a.append(ratio);

            let label = document.createElement("span");
            label.appendChild(document.createTextNode(values.title));
            label.classList.add("yt-ui-menu-item-label");
            a.append(label);

            li.append(a);
            ul.append(li);
        }
        container.append(ul);
    }

    /**
    * Actions related to video: retrieving values, building rankings and displaying ratio. The actions will be executed only of the videohas likes and dislikes
    * are available (displayed by the user that posted the video).
    */
    function doVideoRelatedActions() {
        let values = retrieveValues();

        // the video is worth registering (has likes and dislikes)
        if (values !== null) {
            let rankings = saveValuesAndComputeRankings(values, RANKING_MAX_VIDEOS);
            displayRatio(values.ratio, rankings);
        }
    }

    /**
    * Actions to do on the loading of a video: setting up mutation observers and then doing video-related actions.
    */
    function init() {
        // on DOM change, run video-related actions if a button has been clicked
        let buttonObserver = new MutationObserver(function(mutations) {
            let classChanged = false;
            mutations.some(el => {
                let isAttNameClass = el.attributeName === "class";
                if (isAttNameClass) {
                    doVideoRelatedActions();
                }
                return isAttNameClass;
            });
        });

        // observe changes on native buttons
        Array.from(document.querySelectorAll(".like-button-renderer > span button")).forEach(el => {
            buttonObserver.observe(el, {
                attributes: true
            });
        });

        doVideoRelatedActions();
    }

    init();

    window.addEventListener("spfdone", function(e) {
        init();
    });
})();