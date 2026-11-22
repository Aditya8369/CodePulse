package codepulse

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const SDKVersion = "1.0.0"

type HealthStatus struct {
	Status    string `json:"status"`
	Version   string `json:"version"`
	Timestamp string `json:"timestamp"`
}

type DeveloperProfile struct {
	ID       string  `json:"id"`
	Username string  `json:"username"`
	Name     *string `json:"name"`
	Avatar   *string `json:"avatar"`
	XP       int     `json:"xp"`
	Level    int     `json:"level"`
}

type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("codepulse API error (%d): %s", e.StatusCode, e.Body)
}

type ClientOption func(*Client)

type Client struct {
	BaseURL     string
	BearerToken string
	APIKey      string
	MaxRetries  int
	BaseBackoff time.Duration
	HTTPClient  *http.Client
}

func WithBearerToken(token string) ClientOption {
	return func(c *Client) { c.BearerToken = token }
}

func WithAPIKey(key string) ClientOption {
	return func(c *Client) { c.APIKey = key }
}

func WithMaxRetries(retries int) ClientOption {
	return func(c *Client) { c.MaxRetries = retries }
}

func NewClient(baseURL string, opts ...ClientOption) *Client {
	if baseURL == "" {
		baseURL = "https://api.codepulse.dev/api/v1"
	}
	c := &Client{
		BaseURL:     strings.TrimRight(baseURL, "/"),
		MaxRetries:  3,
		BaseBackoff: 200 * time.Millisecond,
		HTTPClient:  &http.Client{Timeout: 15 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) Do(ctx context.Context, method, routePath string, body any, out any) error {
	endpoint := fmt.Sprintf("%s/%s", c.BaseURL, strings.TrimLeft(routePath, "/"))

	var encoded []byte
	if body != nil {
		var err error
		encoded, err = json.Marshal(body)
		if err != nil {
			return err
		}
	}

	for attempt := 0; attempt <= c.MaxRetries; attempt++ {
		var reader io.Reader
		if encoded != nil {
			reader = bytes.NewReader(encoded)
		}

		req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
		if err != nil {
			return err
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "codepulse-go/"+SDKVersion)
		if c.BearerToken != "" {
			req.Header.Set("Authorization", "Bearer "+c.BearerToken)
		}
		if c.APIKey != "" {
			req.Header.Set("X-API-Key", c.APIKey)
		}

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			if attempt < c.MaxRetries {
				time.Sleep(time.Duration(float64(c.BaseBackoff) * math.Pow(2, float64(attempt))))
				continue
			}
			return err
		}

		rawBytes, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if out != nil && len(rawBytes) > 0 {
				return json.Unmarshal(rawBytes, out)
			}
			return nil
		}

		isRetryable := resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode < 600)
		if isRetryable && attempt < c.MaxRetries {
			delay := time.Duration(float64(c.BaseBackoff) * math.Pow(2, float64(attempt)))
			if ra := resp.Header.Get("Retry-After"); ra != "" {
				if sec, convErr := strconv.Atoi(ra); convErr == nil && sec >= 0 {
					delay = time.Duration(sec) * time.Second
				}
			}
			time.Sleep(delay)
			continue
		}

		return &APIError{StatusCode: resp.StatusCode, Body: string(rawBytes)}
	}

	return &APIError{StatusCode: http.StatusServiceUnavailable, Body: "exhausted retries"}
}

func (c *Client) GetSystemHealth(ctx context.Context) (*HealthStatus, error) {
	var res HealthStatus
	if err := c.Do(ctx, http.MethodGet, "/health", nil, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetDeveloperByUsername(ctx context.Context, username string) (*DeveloperProfile, error) {
	var res DeveloperProfile
	route := "/users/" + url.PathEscape(username)
	if err := c.Do(ctx, http.MethodGet, route, nil, &res); err != nil {
		return nil, err
	}
	return &res, nil
}
