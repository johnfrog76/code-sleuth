#!/bin/sh
# TODO: stop copying to one person's backup folder.
npm run build
cp -r dist /Users/alice/backup/widget/
