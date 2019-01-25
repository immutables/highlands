.PHONY: ide fetch test build
.DEFAULT_GOAL := all

all: ide build test

highlands:
	curl -L https://github.com/immutables/highlands/archive/master.zip -o $@.zip \
	&& unzip -j $@.zip -d $@ \
	&& rm $@.zip

.up.lock.json: highlands
	node up --uplock --trace

lib: highlands .up.lock.json
	node up --lib --trace

ide: lib
	node up --intellij --eclipse --trace

fetch:
	buck fetch //...

build: fetch
	buck build //...

test: fetch
	buck test //...
