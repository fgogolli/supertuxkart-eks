package main

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_handleLogLine(t *testing.T) {
	tests := []struct {
		name   string
		line   string
		want   string
		player string
	}{
		{
			name:   "start",
			line:   `Fri Sep 18 16:22:11 2020 [info   ] STKHost: Listening has been started.`,
			want:   "READY",
			player: "",
		},
		{
			name:   "player join",
			line:   `Fri Sep 18 01:54:59 2020 [info   ] ServerLobby: New player sudermanjr with online id 0 from 64.40.3.124:15009 with SuperTuxKart/1.1 (Macintosh).`,
			want:   "PLAYERJOIN",
			player: "sudermanjr",
		},
		{
			name:   "player leave",
			line:   `Thu Sep 17 23:27:57 2020 [info   ] ServerLobby: sudermanjr disconnected`,
			want:   "PLAYERLEAVE",
			player: "sudermanjr",
		},
		{
			name:   "shutdown",
			line:   `Thu Sep 17 23:27:57 2020 [info   ] STKHost: 64.40.3.124:52325 has just disconnected. There are now 0 peers.`,
			want:   "SHUTDOWN",
			player: "",
		},
		{
			name:   "other",
			line:   `Thu Sep 17 23:23:07 2020 [info   ] ServerLobby: Message of type 17 received.`,
			want:   "",
			player: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, player := handleLogLine(tt.line)
			assert.EqualValues(t, tt.want, got)
			if player != nil {
				assert.Equal(t, tt.player, *player)
			}
		})
	}
}
