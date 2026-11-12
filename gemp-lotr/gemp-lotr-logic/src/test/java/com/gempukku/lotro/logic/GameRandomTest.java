package com.gempukku.lotro.logic;

import com.gempukku.lotro.game.PhysicalCard;
import org.junit.Test;

import java.lang.reflect.Proxy;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.IntStream;

import static org.junit.Assert.*;

public class GameRandomTest {
    private static List<Integer> shuffled(GameRandom random) {
        List<Integer> cards = new ArrayList<>(IntStream.range(0, 60).boxed().toList());
        Collections.shuffle(cards, random.get());
        return cards;
    }

    @Test
    public void withoutASeedEveryDrawIsTheThreadsOwnRandom() {
        assertSame(ThreadLocalRandom.current(), new GameRandom(null).get());
    }

    @Test
    public void theSameSeedGivesEveryGameTheSameDraws() {
        GameRandom first = new GameRandom(42L);
        GameRandom second = new GameRandom(42L);
        assertEquals(shuffled(first), shuffled(second));
        // and keeps doing so, draw after draw
        assertEquals(shuffled(first), shuffled(second));
        assertEquals(first.get().nextInt(1000), second.get().nextInt(1000));
    }

    @Test
    public void eachGameHasItsOwnSequence() {
        GameRandom first = new GameRandom(42L);
        GameRandom second = new GameRandom(42L);
        shuffled(first);
        // a draw in one game doesn't move the other one on
        assertEquals(shuffled(new GameRandom(42L)), shuffled(second));
    }

    @Test
    public void theSeedComesFromTheSystemProperty() {
        String before = System.getProperty(GameRandom.SEED_PROPERTY);
        try {
            System.setProperty(GameRandom.SEED_PROPERTY, "7");
            assertEquals(shuffled(new GameRandom(7L)), shuffled(new GameRandom()));
            System.clearProperty(GameRandom.SEED_PROPERTY);
            assertSame(ThreadLocalRandom.current(), new GameRandom().get());
        } finally {
            if (before != null)
                System.setProperty(GameRandom.SEED_PROPERTY, before);
        }
    }

    private static PhysicalCard card(int id) {
        return (PhysicalCard) Proxy.newProxyInstance(PhysicalCard.class.getClassLoader(), new Class<?>[]{PhysicalCard.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getCardId" -> id;
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    case "toString" -> "card " + id;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }

    private static List<Integer> ids(List<PhysicalCard> cards) {
        return cards.stream().map(PhysicalCard::getCardId).toList();
    }

    private static void withSeed(String seed, Runnable test) {
        String before = System.getProperty(GameRandom.SEED_PROPERTY);
        try {
            if (seed == null)
                System.clearProperty(GameRandom.SEED_PROPERTY);
            else
                System.setProperty(GameRandom.SEED_PROPERTY, seed);
            test.run();
        } finally {
            if (before == null)
                System.clearProperty(GameRandom.SEED_PROPERTY);
            else
                System.setProperty(GameRandom.SEED_PROPERTY, before);
        }
    }

    @Test
    public void aSeededServerListsTheCardsOfASetByCardId() {
        Set<PhysicalCard> set = new HashSet<>(List.of(card(147), card(9), card(143), card(31)));
        withSeed("1", () -> assertEquals(List.of(9, 31, 143, 147), ids(GameRandom.stableOrder(set))));
    }

    @Test
    public void aListKeepsItsOrderEvenOnASeededServer() {
        List<PhysicalCard> list = List.of(card(147), card(9), card(143));
        withSeed("1", () -> assertEquals(List.of(147, 9, 143), ids(GameRandom.stableOrder(list))));
    }

    @Test
    public void withoutASeedASetKeepsItsOwnOrder() {
        Set<PhysicalCard> set = new HashSet<>(List.of(card(147), card(9), card(143), card(31)));
        List<Integer> asTheSetHasThem = set.stream().map(PhysicalCard::getCardId).toList();
        withSeed(null, () -> assertEquals(asTheSetHasThem, ids(GameRandom.stableOrder(set))));
    }
}
