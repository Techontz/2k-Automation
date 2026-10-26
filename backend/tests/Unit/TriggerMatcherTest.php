<?php

namespace Tests\Unit;

use App\Services\Automation\TriggerMatcher;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class TriggerMatcherTest extends TestCase
{
    /**
     * @return array<string, array{0: string, 1: array<string, mixed>, 2: string|null|false}>
     */
    public static function cases(): array
    {
        return [
            'case insensitive' => ['link please', ['keywords' => ['LINK']], 'LINK'],
            'with emoji' => ['🔥LINK🔥', ['keywords' => ['LINK']], 'LINK'],
            'whole words only' => ['linkedin?', ['keywords' => ['LINK']], false],
            'multi word keyword' => ['send me the free guide', ['keywords' => ['free guide']], 'free guide'],
            'exact mode' => ['link please', ['keywords' => ['LINK'], 'match' => 'exact'], false],
            'exact match' => ['  Link ', ['keywords' => ['LINK'], 'match' => 'exact'], 'LINK'],
            'any comment' => ['nice video', ['match' => 'any'], null],
            'excluded word' => ['link is broken', ['keywords' => ['LINK'], 'exclude_keywords' => ['broken']], false],
            'swahili' => ['naomba bei', ['keywords' => ['bei', 'price']], 'bei'],
        ];
    }

    /**
     * @param  array<string, mixed>  $config
     */
    #[DataProvider('cases')]
    public function test_keyword_matching(string $text, array $config, string|null|false $expected): void
    {
        $this->assertSame($expected, (new TriggerMatcher)->matchText($text, $config));
    }
}
