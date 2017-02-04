# YT ratio
A simple userscript to use like / dislike ratio of a visited Youtube video to build browsable rankings. The idea behind
this project was to see in an easy way which videos visited by the user are well-received by the Youtube community.

Each time a video is visited, the likes, dislikes, their ratio, the view count and the url are stored in the local storage.
After this, rankings based on the view count and ratio are updated and are browsable by the user.

The rankings are separated accordingly to the number of views of a video, since it would make little sense to compare
a video with a big ratio but only something like 500 views and another video with a smaller ratio but more than a 
million views. In that way, the ranking of "popular" videos with a big view count are often more insteresting that those
concerning videos with a smaller view count.

*Warning: if you intend to use this script, keep in mind that this project was done mostly for fun, does not support all languages on youtube (doesn't work with japanese / vietnamese display for example) and may not be up to date with the changes done on Youtube's part.*

## Overview of the features

The script adds the following elements:

- When a video has likes and dislikes shown, the ratio is displayed and a new button is added.

![ratio](https://cloud.githubusercontent.com/assets/2306585/22619215/4091ea66-eaf0-11e6-8377-5b29ba1e5da9.png)

- When the button is clicked, the rankings are shown. A click on an entry of the ranking opens the related video.

![rankings](https://cloud.githubusercontent.com/assets/2306585/22621387/c8d2c51c-eb22-11e6-881b-fefbf9af17de.png)

## Installation

For this step, we will use the extension `TamperMonkey`. Although untested, it can probably work on `GreaseMonkey` as well.

1. Copy the content of `yt-ratio.js`.
2. Create new script in `Tampermonkey`.
3. Paste the code in it and save it. You're done!
