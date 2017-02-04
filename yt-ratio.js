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
    const RANKING_MAX_VIDEOS = 50; // the step (as a factor) between each ranking


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
        let values = document.querySelectorAll(".like-button-renderer > span:nth-of-type(odd) button span");

        // no likes / dislikes
        if (values.length === 0) {
            return null;
        }

        let id = document.location.href.match(".*?v=([A-Za-z0-9_\-]{11})")[1];
        let title = document.querySelector("#eow-title").title;

        let viewCount = parseInt(document.querySelector(".watch-view-count").textContent.split(/[\s,.]+/).slice(0, -1).join(""));

        let likes = parseInt(values[0].textContent.replace(/[\s,.]+/g, ""));
        let dislikes = parseInt(values[1].textContent.replace(/[\s,.]+/g, ""));

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
    * Displays the ratio of likes / dislikes of the video. Adds an icon that allows displaying rankings on click.
    *
    * @param {Number} ratio - The ratio of likes / dislikes.
    * @param {Object} rankings - The rankings computed (@see {@link computeRankings}).
    */
    function displayRatio(ratio, rankings) {
        GM_addStyle(`
            .ratio-icon:before {
                margin-right: 4px !important;
                opacity: 1 !important;
                margin-bottom: 3px !important;
            }
        `);

        let ratioValue = document.createElement("span");
        ratioValue.classList.add("yt-uix-button-content");
        ratioValue.appendChild(document.createTextNode(ratio.toFixed(2)));

        let button = document.createElement("button");
        button.classList.add("yt-uix-button", "yt-uix-button-opacity", "yt-ui-menu-item", "has-icon", "action-panel-trigger-stats", "ratio-icon");
        button.style.width = "inherit";
        button.onclick = function (e) {
            displayRankings(rankings, button);
        };
        button.appendChild(ratioValue);

        let ratioSpan = document.createElement("span");
        ratioSpan.appendChild(button);
        ratioSpan.setAttribute("title", "Ratio likes / dislikes");

        document.querySelector(".like-button-renderer").appendChild(ratioSpan);
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
    * @return {Object} The computed rankings.
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

    function displayRankings(rankings, button) {
        let availableRect = document.querySelector("#watch-headline-title").getBoundingClientRect();
        let width = availableRect.right - availableRect.left;
        let height = 500;

        let coords = getCoords(button);
        let rect = button.getBoundingClientRect();
        let buttonWidth = rect.right - rect.left;

        let rankingsContainer = document.createElement("div");
        rankingsContainer.classList.add("yt-uix-menu-content", "yt-ui-menu-content", "yt-uix-kbd-nav");
        rankingsContainer.role = "menu";
        rankingsContainer.style.width = width + "px";
        rankingsContainer.style.height = height + "px";
        rankingsContainer.style.overflow = "scroll";

        rankingsContainer.style.left = (coords.left + buttonWidth - width) + "px";
        rankingsContainer.style.top = (coords.top + 30) + "px";
        rankingsContainer.ariaExpanded = "true";
        rankingsContainer.dataKbddNavMoveOut="action-panel-overflow-button";

        let title = document.createElement("h1");
        title.append(document.createTextNode("Rankings of likes / dislikes ratios grouped by view count"));
        title.style.marginLeft = "15px";

        rankingsContainer.append(title);

        for (let i = 0; i < rankings.length; ++i) {
          buildList(rankingsContainer, rankings[i]);
        }

        document.addEventListener("click", function(e) {
            if (!rankingsContainer.contains(e.target) && !button.contains(e.target)) {
                rankingsContainer.remove();
            }
        });

        document.querySelector("body").append(rankingsContainer);
    }

    function buildList(container, ranking) {
        let title = document.createElement("h2");
        title.style.borderTop = "1px solid #e2e2e2";
        title.style.margin = "7px 15px 0px";
        title.style.padding = "7px 15px 5px";
        title.appendChild(document.createTextNode(ranking.lower.toLocaleString() + " - " + ranking.upper.toLocaleString() + " views"));
        container.append(title);

        let headers = document.createElement("span");
        headers.style.marginLeft = "15px";
        headers.style.fontWeight = "500";

        let posHeader = document.createElement("span");
        posHeader.style.display = "inline-block";
        posHeader.style.width = "20px";
        posHeader.style.textAlign = "right";
        posHeader.style.marginRight = "10px";
        posHeader.append(document.createTextNode("#"));
        headers.append(posHeader);

        let ratioHeader = document.createElement("span");
        ratioHeader.style.display = "inline-block";
        ratioHeader.style.width = "40px";
        ratioHeader.style.textAlign = "center";
        ratioHeader.style.marginRight = "10px";
        ratioHeader.append(document.createTextNode("ratio"));
        headers.append(ratioHeader);

        let titleHeader = document.createElement("span");
        titleHeader.append(document.createTextNode("title"));
        headers.append(titleHeader);

        container.append(headers);

        let ul = document.createElement("ul");
        ul.classList.add("yt-uix-kbd-nav", "yt-uix-kbd-nav-list");
        ul.style.marginTop = "3px";

        for (let i = 0; i < ranking.values.length; ++i) {
            let values = ranking.values[i];

            let li = document.createElement("li");
            let a = document.createElement("a");
            a.href = "https://www.youtube.com/watch?v=" + values.id;
            a.classList.add("yt-ui-menu-item");

            let place = document.createElement("span");
            place.style.width = "20px";
            place.style.marginRight = "10px";
            place.style.display = "inline-block";
            place.style.textAlign = "right";
            place.appendChild(document.createTextNode(i + 1));
            a.append(place);

            let ratio = document.createElement("span");
            ratio.style.width = "40px";
            ratio.style.marginRight = "10px";
            ratio.style.display = "inline-block";
            ratio.style.textAlign = "right";
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

    function doVideoRelatedActions() {
        let values = retrieveValues();

        // the video is worth registering (has likes and dislikes)
        if (values !== null) {
            let rankings = saveValuesAndComputeRankings(values, RANKING_MAX_VIDEOS);
            displayRatio(values.ratio, rankings);
        }
    }

    doVideoRelatedActions();

    window.addEventListener("spfdone", function(e) {
        doVideoRelatedActions();
    });
})();