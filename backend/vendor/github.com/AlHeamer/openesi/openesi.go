package openesi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/AlHeamer/openesi/esi"
	"github.com/AlHeamer/openesi/jwks"
	"github.com/lestrrat-go/jwx/v3/jwt"
	"golang.org/x/oauth2"
)

const (
	openesiUserAgent = "openesi/0.0.0 (eve:Al Heamer; +https://github.com/AlHeamer/openesi)"
)

type Client struct {
	ESI           *esi.APIClient
	jwks          *jwks.Jwks
	oauthMetadata *jwks.EveOnlineOauthMetadata
	oauthConfig   *oauth2.Config
}

func NewClient(
	ctx context.Context,
	appId string,
	appSecret string,
	appRedirect string,
	appUserAgent string,
	//defaultCompatabilityDate string,
	httpClient *http.Client,
	jwksSkew time.Duration,
) (*Client, error) {
	if httpClient == nil {
		return nil, errors.New("httpClient not provided")
	}
	cfg := esi.NewConfiguration()
	cfg.UserAgent = strings.Join([]string{appUserAgent, openesiUserAgent, cfg.UserAgent}, " ")
	cfg.HTTPClient = httpClient
	cfg.DefaultHeader = map[string]string{
		//"X-Compatability-Date": defaultCompatabilityDate,
	}

	oauthMetadata, err := jwks.FetchEveWellKnown(httpClient)
	if err != nil {
		return nil, err
	}

	jwks, err := jwks.NewJwks(ctx, appId, jwksSkew, oauthMetadata)
	if err != nil {
		return nil, err
	}

	config := &oauth2.Config{
		ClientID:     appId,
		ClientSecret: appSecret,
		RedirectURL:  appRedirect,
		Endpoint: oauth2.Endpoint{
			AuthURL:  oauthMetadata.AuthorizationEndpoint,
			TokenURL: oauthMetadata.TokenEndpoint,
		},
	}

	c := &Client{
		ESI:           esi.NewAPIClient(cfg),
		jwks:          jwks,
		oauthMetadata: oauthMetadata,
		oauthConfig:   config,
	}
	return c, nil
}

func (c *Client) AuthorizeUrl(state string, onlineAccess bool, scopes []string) string {
	access := oauth2.AccessTypeOffline
	if onlineAccess {
		access = oauth2.AccessTypeOnline
	}

	return c.oauthConfig.AuthCodeURL(state, access, oauth2.SetAuthURLParam("scope", strings.Join(scopes, " ")))
}

func (c *Client) TokenExchange(code string) (*oauth2.Token, error) {
	ctx := context.WithValue(context.Background(), oauth2.HTTPClient, c.ESI.GetConfig().HTTPClient)
	return c.oauthConfig.Exchange(ctx, code)
}

func (c *Client) TokenSource(token *oauth2.Token) oauth2.TokenSource {
	ctx := context.WithValue(context.Background(), oauth2.HTTPClient, c.ESI.GetConfig().HTTPClient)
	return c.oauthConfig.TokenSource(ctx, token)
}

func (c *Client) VerifyTokenClaims(ctx context.Context, accessToken []byte, parseOpts ...jwt.ParseOption) (*jwks.TokenClaims, error) {
	return c.jwks.VerifyTokenClaims(ctx, accessToken, parseOpts...)
}
