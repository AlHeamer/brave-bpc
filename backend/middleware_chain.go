package main

import "slices"

import "net/http"

type middleware func(http.Handler) http.Handler
type mwChain struct {
	chain []middleware
}

func NewMwChain(mw ...middleware) *mwChain {
	return &mwChain{chain: mw}
}

func (c *mwChain) Clone() *mwChain {
	clone := *c
	return &clone
}

func (c *mwChain) Add(mw ...middleware) *mwChain {
	return &mwChain{chain: append(c.Clone().chain, mw...)}
}

func (c *mwChain) Handle(h http.Handler) http.Handler {
	if len(c.chain) == 0 {
		return h
	}

	wrap := h
	for _, v := range slices.Backward(c.chain) {
		wrap = v(wrap)
	}

	return wrap
}

func (c *mwChain) HandleFunc(fn func(http.ResponseWriter, *http.Request)) http.Handler {
	return c.Handle(http.HandlerFunc(fn))
}
