# The artists behind Paint Clash

**Real artists; an imagined rivalry.** The twelve artists were alive in 1888, but never formed these opposing teams. The crews combine overlapping friendships, exhibitions and experiments in colour. Roles, weapons, mottos and tactical personalities are game design.

Ages below are anchored to **31 December 1888**, matching `age1888` in `src/factions.js`. They describe the historical artists at that date, not the date of every portrait used as a reference.

## Gold — The Yellow House

The name recalls Van Gogh’s proposed shared studio in Arles. Gauguin joined him there in 1888; the other four crew members were not Yellow House residents. This expanded crew brings together different approaches to colour and structure. [Van Gogh Museum](https://www.vangoghmuseum.nl/en/collection/s0032V1962), [Art Institute of Chicago](https://archive.artic.edu/vangogh/studiosud.html)

| Role | Artist | Born · age | Historical connection |
| --- | --- | --- | --- |
| Vanguard | Vincent van Gogh | 1853 · 35 | Prepared the Yellow House for a shared studio. [Van Gogh Museum](https://www.vangoghmuseum.nl/en/collection/s0032V1962) |
| Flanker | Paul Gauguin | 1848 · 40 | Sent Van Gogh a self-portrait in 1888, then joined him in Arles. [Van Gogh Museum](https://catalogues.vangoghmuseum.com/contemporaries-of-van-gogh-1/cat57) |
| Anchor | Paul Cézanne | 1839 · 49 | Pursued increasingly ordered brushwork and colour-built form during the 1880s. [National Gallery](https://www.nationalgallery.org.uk/artists/paul-cezanne) |
| Marksman | Georges Seurat | 1859 · 29 | Presented *La Grande Jatte* at the 1886 Impressionist exhibition. [Art Institute of Chicago](https://archive.artic.edu/seurat/seurat_themes.html) |
| Support | Paul Signac | 1863 · 25 | Developed Divisionist painting alongside Seurat. [Musée d’Orsay](https://www.musee-orsay.fr/en/program/whats-on/exhibitions/presentation/paul-signac-1863-1935) |
| Scout | Henri de Toulouse-Lautrec | 1864 · 24 | Portrayed Van Gogh in Paris in 1887. [Van Gogh Museum](https://catalogues.vangoghmuseum.com/contemporaries-of-van-gogh-1/cat132) |

## Blue — The Independents

Here **The Independents is a fictional crew name**. It does not claim that this roster belonged to the Société des artistes indépendants. The crew brings together major Impressionists with different interests in landscape, modern life and the human figure.

| Role | Artist | Born · age | Historical connection |
| --- | --- | --- | --- |
| Vanguard | Claude Monet | 1840 · 48 | Settled at Giverny in 1883 and explored changing light. [National Gallery](https://www.nationalgallery.org.uk/artists/claude-monet) |
| Flanker | Pierre-Auguste Renoir | 1841 · 47 | Worked alongside Monet on the Seine in 1869. [National Gallery](https://www.nationalgallery.org.uk/artists/pierre-auguste-renoir) |
| Anchor | Edgar Degas | 1834 · 54 | Exhibited with the Impressionists and studied modern life through drawing, painting and pastel. [National Gallery](https://www.nationalgallery.org.uk/artists/hilaire-germain-edgar-degas) |
| Marksman | Berthe Morisot | 1841 · 47 | A principal Impressionist alongside Monet, Renoir, Degas and Pissarro. [Musée Marmottan Monet](https://www.marmottan.fr/collections/berthe-morisot/) |
| Support | Camille Pissarro | 1830 · 58 | Participated in all eight Impressionist exhibitions and experimented with Neo-Impressionism from 1886. [Ashmolean Museum](https://www.ashmolean.org/view-my-window) |
| Scout | Mary Cassatt | 1844 · 44 | Invited by Degas, exhibited with the group in 1879, 1880, 1881 and 1886. [The Met](https://www.metmuseum.org/essays/mary-stevenson-cassatt-1844-1926) |

Morisot and Cassatt are central artists in this history, with period self-portraits that support distinct, recognisable characters. Their inclusion reflects their established artistic importance; their combat roles imply no historical skills or temperament.

The teams are deliberately porous: Pissarro experimented with Seurat’s approach, and Signac visited Van Gogh warmly in March 1889. That visit is later context, not an event moved into 1888. [Ashmolean Museum](https://www.ashmolean.org/view-my-window), [Van Gogh’s letter of 24 March 1889](https://vangoghletters.org/vg/letters/let752/letter.html)

## Appearance and implementation

[CHARACTER-DESIGN.md](CHARACTER-DESIGN.md) separates portrait evidence from invented body proportions, costume and animation. `src/factions.js` owns the roster and references; `src/actors.js` interprets its appearance data. Both crews retain the role order vanguard, flanker, anchor, marksman, support, scout. Museum links are optional research references, not runtime asset dependencies.

## Personal tags

Each artist has an original spray emblem inspired by a work or painting technique. [ARTIST-TAGS.md](ARTIST-TAGS.md) records all twelve designs, museum sources and the spray behavior. The tags draw across the artists’ careers: Monet’s lily bridge refers to an 1899 painting, and Toulouse-Lautrec’s poster motif to an 1891 print. Those are deliberate later-career allusions within the fictional game; the cast’s age anchor remains 1888. Sprays are temporary game effects, preserving the original town artwork and map.
