var hoverZoomPlugins = hoverZoomPlugins || [];
hoverZoomPlugins.push({
    name:'Inkbunny',
    version:'0.1',
    prepareImgLinks:function (callback) {
        var res = [];

        //  TODO
        //  change to full size image, not screen
        //  hoverzooming updated submissions in user's new submissions notifications will screw up indexing

        //find all submission links
        $('a[href*="s/"]').filter(function() {
            return /s\/\d+(-p\d+)?(-latest)?(-?#pictop)?\/?$/.test($(this).attr('href'));
        }).one('mouseover', function() {
            var link = $(this),
                url = link.attr('href');

            //follow a submission link
            $.ajax(url).done(function(response) {
                //console.log("url: " + url);

                //get the submission's src
                var img = $('img[src*="files/screen/"]', response).first();
                //console.log(img);

                if (img.length) {
                    link.data().hoverZoomSrc = [img.attr('src')];
                } else {
                    var thumbSrc = link.find('img').attr('src');
                    if (!(/_noncustom\.\w+$/.test(thumbSrc)))
                        link.data().hoverZoomSrc = [thumbSrc.replace(/thumbnails\/\w+/, 'thumbnails/huge')];
                    else
                        link.data().hoverZoomSrc = [thumbSrc];
                }
                link.data().hoverZoomCaption = $(response).text().replace(/^\s*(.*) <[\s\S]*/, '$1');

                //console.log(link.data());
                //console.log("mainSrc: " + img.attr('src'));

                //check if the submission has other pages. these are found in links
                //that contain the base url and have an img child
                var multipageContainer = $('#files_area ~ div', response),
                    firstPage = url.replace(/^(.*s\/\d+).*$/, '$1'),
                    multipageLinks = $('a[href*="' + firstPage + '"]:has(img)', multipageContainer);

                /* console.log("firstPage: " + firstPage);
                console.log("multipageLinks:");
                console.log(multipageLinks); */

                //submission has multiple pages
                if (multipageLinks.length) {
                    //console.log("multipageLinks URLs:");

                    link.data().hoverZoomGallerySrc = [];
                    link.data().hoverZoomGalleryCaption = [];

                    var startIndex = url.replace(/^(.*s\/\d+)-p(\d+)?.*$/, '$2');
                    startIndex = (startIndex === url) ? 0 : parseInt(startIndex) - 1;
                    link.data().hoverZoomGalleryIndex = startIndex;

                    var i = 0, loopData = {
                        start: mod(startIndex - 2, multipageLinks.length),
                        end: mod(startIndex + 2, multipageLinks.length) };
                    link.on('wheel', {arg1: loopData, arg2: multipageLinks}, onMouseWheel);
                    link.hover(function() {
                        link.focus();
                    }, function() {
                        link.blur();
                    }).on('keydown', {arg1: loopData, arg2: multipageLinks}, onKeyDown);
                    link.focus();
                    multipageLinks.each(function() {
                        var multipageLink = $(this).attr('href');
                        //console.log(multipageLink);

                        link.data().hoverZoomGallerySrc.push([]);
                        link.data().hoverZoomGalleryCaption.push(link.data().hoverZoomCaption);

                        if (multipageLinks.length > 4) {
                            if (inCircularRange(loopData.start, loopData.end, i)) {
                                prepareMultipageSrcAsync(link, multipageLink, i);
                            }
                        } else {
                            prepareMultipageSrcAsync(link, multipageLink, i);
                        }

                        i++;
                    });
                }
                link.addClass('hoverZoomLink');
                res.push(link);
                hoverZoom.displayPicFromElement(link);
            });
        });

        function prepareMultipageSrcAsync(origLink, multipageLink, i) {
            $.ajax(multipageLink).done(function(nestedResponse) {
                var multipageImg = $('img[src*="files/screen/"]', nestedResponse).first();
                if (multipageImg.length) {
                    origLink.data().hoverZoomGallerySrc[i] = [multipageImg.attr('src')];
                } else {
                    var thumbSrc = origLink.find('img').attr('src');
                    if (/\/images78\/overlays/.test(thumbSrc))
                        origLink.data().hoverZoomGallerySrc[i] = [thumbSrc];
                    else if (!(/_noncustom\.\w+$/.test(thumbSrc)))
                        origLink.data().hoverZoomGallerySrc[i] = [thumbSrc.replace(/thumbnails\/\w+/, 'thumbnails/huge')];
                }
            });
        }

        function mod(m, n) {
            return ((m % n) + n) % n;
        }

        function inCircularRange(start, end, i) {
            if (start <= end)
                return (i >= start && i <= end);
            else
                return (i >= start || i <= end);
        }

        function galleryIndexNearEdge(start, end, galleryIndex, galleryLength) {
            return inCircularRange(end, mod(start + 2, galleryLength), galleryIndex) ||
                inCircularRange(mod(end - 2, galleryLength), start, galleryIndex);
        }

        function onMouseWheel(event) {
            var loopData = event.data.arg1,
                multipageLinks = event.data.arg2;

            if (event.originalEvent.wheelDeltaY > 0)
                multipageSrcHelper(loopData, multipageLinks, -1);
            else if (event.originalEvent.wheelDeltaY < 0)
                multipageSrcHelper(loopData, multipageLinks, 1);
        }

        function onKeyDown(event) {
            var loopData = event.data.arg1,
                multipageLinks = event.data.arg2;

            if (event.which == options.prevImgKey)
                multipageSrcHelper(loopData, multipageLinks, -1);
            else if (event.which == options.nextImgKey)
                multipageSrcHelper(loopData, multipageLinks, 1);
        }

        function multipageSrcHelper(loopData, multipageLinks, rot) {
            var totalLinks = multipageLinks.length,
                link = hoverZoom.currentLink,
                data = link.data(),
                nextIndex = mod(data.hoverZoomGalleryIndex + rot, totalLinks),
                loadIndex = mod(data.hoverZoomGalleryIndex + 3 * rot, totalLinks);
            console.log("start: " + loopData.start);
            console.log("end: " + loopData.end);

            if (!data.hoverZoomGallerySrc[nextIndex].length) {
                data.hoverZoomGalleryIndex = mod(data.hoverZoomGalleryIndex - rot, totalLinks);
                return;
            }

            if (data.hoverZoomGallerySrc && data.hoverZoomGallerySrc.length > 1) {
                console.log("scrolling to " + nextIndex + " from " + data.hoverZoomGalleryIndex);
                console.log("load " + loadIndex + "?");

                if (!inCircularRange(loopData.start, loopData.end, loadIndex) &&
                        galleryIndexNearEdge(loopData.start, loopData.end, nextIndex, totalLinks)) {
                    console.log("doing ajax");

                    prepareMultipageSrcAsync(link, multipageLinks[loadIndex].href, loadIndex);
                    if (rot === -1)
                        loopData.start = mod(loopData.start - 1, totalLinks);
                    else if (rot === 1)
                        loopData.end = mod(loopData.end + 1, totalLinks);
                } else if (Math.abs(loopData.end - loopData.start) === 1) {
                    link.off();
                }
            }
        }

        callback($(res));
    }
});